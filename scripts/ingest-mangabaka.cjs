const { readFileSync, existsSync } = require("node:fs");
const { createReadStream } = require("node:fs");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGunzip } = require("node:zlib");
const tar = require("tar-stream");
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { isNotNull } = require("drizzle-orm");
const schema = require("@ambl/database");
const { toMangabakaSeriesRow, upsertMangabakaSeries } = require("@ambl/database");

const DEFAULT_URL = "https://api.mangabaka.org/v1/database/series.jsonl.tar.gz";
const MEMBER_NAME = "series.jsonl";
const DEFAULT_CATALOGUE_YEARS = 10;
const BATCH_SIZE = 500;

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || m[1] in process.env) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
  return true;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > -1) args[a.slice(2, eq)] = a.slice(eq + 1);
    else args[a.slice(2)] = "true";
  }
  return args;
}

class JsonLineSplitter extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this.buf = "";
  }
  _transform(chunk, _enc, cb) {
    this.buf += chunk.toString("utf8");
    let idx;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, idx).replace(/\r$/, "");
      this.buf = this.buf.slice(idx + 1);
      if (line.trim()) this.push(line);
    }
    cb();
  }
  _flush(cb) {
    if (this.buf.trim()) this.push(this.buf.trim());
    cb();
  }
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseYear(d) {
  if (!d) return null;
  const m = /^(\d{4})/.exec(d);
  return m ? Number(m[1]) : null;
}

function shouldKeep(rec, refs, cutoffYear) {
  // Existing references always win over the catalogue age filter so older
  // titles already used by the app remain available.
  const mb = num(rec.id);
  if (mb && refs.mb.has(mb)) return true;
  const mal = num(rec.source && rec.source.my_anime_list && rec.source.my_anime_list.id);
  if (mal && refs.mal.has(mal)) return true;
  const ani = num(rec.source && rec.source.anilist && rec.source.anilist.id);
  if (ani && refs.ani.has(ani)) return true;
  if ((rec.content_rating || "").toLowerCase() === "erotica") return false;
  if (rec.state && rec.state !== "active") return false;
  // Keep the active catalogue to the rolling last N calendar years.
  const y = num(rec.year) ?? parseYear(rec.published && rec.published.start_date);
  return typeof y === "number" && y >= cutoffYear;
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = args["dry-run"] === "true";
  const limit = Number(args["limit"] || 0) || 0;
  const maxRecords = Number(args["max-records"] || 0) || 0;
  const localPath = args["file"];
  // Rolling catalogue window: keep titles published in the last N calendar
  // years (10 by default, so 2017 onward in 2026).
  const requestedYears = Number(args["years"] || DEFAULT_CATALOGUE_YEARS);
  const catalogueYears =
    Number.isInteger(requestedYears) && requestedYears >= 1 && requestedYears <= 50
      ? requestedYears
      : DEFAULT_CATALOGUE_YEARS;
  const cutoffYear = new Date().getFullYear() - catalogueYears + 1;
  console.log(`catalogue window: years=${catalogueYears} cutoffYear=${cutoffYear}`);

  loadEnvFile("apps/web/.env");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const refs = { mb: new Set(), mal: new Set(), ani: new Set() };
  try {
    const titles = await db
      .select({ malId: schema.titles.malId })
      .from(schema.titles)
      .where(isNotNull(schema.titles.malId));
    for (const r of titles) if (r.malId != null) refs.mal.add(r.malId);
  } catch {}

  let input;
  if (localPath && existsSync(localPath)) {
    input = createReadStream(localPath);
  } else {
    const res = await fetch(DEFAULT_URL);
    if (!res.ok || !res.body) throw new Error("fetch failed");
    input = Readable.fromWeb(res.body);
  }

  const gunzip = createGunzip();
  const ext = tar.extract();
  const splitter = new JsonLineSplitter();
  const rows = [];
  let scanned = 0,
    kept = 0,
    filtered = 0,
    jsonErr = 0,
    inserted = 0;

  ext.on("entry", (header, stream, next) => {
    if (header.name === MEMBER_NAME || header.name.endsWith(MEMBER_NAME)) {
      pipeline(stream, splitter, async function* (src) {
        for await (const line of src) {
          let rec;
          try {
            rec = JSON.parse(line);
          } catch {
            jsonErr++;
            continue;
          }
          scanned++;
          if (shouldKeep(rec, refs, cutoffYear)) {
            rows.push(toMangabakaSeriesRow(rec));
            kept++;
            if (rows.length >= BATCH_SIZE) {
              const valid = rows.filter((x) => x.id != null && x.id > 0);
              if (valid.length) {
                if (!dryRun) await upsertMangabakaSeries(db, valid);
                inserted += valid.length;
              }
              rows.length = 0;
              if (limit && inserted >= limit) break;
            }
          } else {
            filtered++;
          }
          if (maxRecords && scanned >= maxRecords) break;
        }
      })
        .catch(() => {})
        .finally(() => next());
    } else {
      stream.resume();
      stream.on("end", next);
    }
  });

  ext.on("finish", async () => {
    const valid = rows.filter((x) => x.id != null && x.id > 0);
    if (valid.length) {
      if (!dryRun) await upsertMangabakaSeries(db, valid);
      inserted += valid.length;
    }
    console.log(`done: scan=${scanned} kept=${kept} filtered=${filtered} err=${jsonErr} inserted=${inserted}`);
    await sql.end();
  });

  pipeline(input, gunzip, ext).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
