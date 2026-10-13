/**
 * MangaBaka nightly dump ingestion.
 *
 * Streams the official JSONL dump: `series.jsonl.tar.gz` contains `series.jsonl`
 * (UTF-8 JSON Lines, ~564k records). Curates and upserts into `mangabaka_series`.
 */
import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extractTarGzMember, openTarGzFromUrl } from "./tar-utils";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { isNotNull } from "drizzle-orm";
import * as schema from "@ambl/database";
import {
  toMangabakaSeriesRow,
  upsertMangabakaSeries,
  type MangabakaRoot,
} from "@ambl/database";

const DEFAULT_URL = "https://api.mangabaka.org/v1/database/series.jsonl.tar.gz";
const MEMBER_NAME = "series.jsonl";

const POPULARITY_CUTOFF = 20000;
const RATING_FLOOR = 70;
const RECENT_YEAR = new Date().getFullYear() - 1;
const RECENT_MS = 90 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500; // smaller for safe streaming

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
    if (!m || m[1] in process.env) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
  return true;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq > -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else args[arg.slice(2)] = "true";
  }
  return args;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseYear(date?: string | null): number | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? Number(m[1]) : null;
}

interface RefSets {
  mb: Set<number>;
  mal: Set<number>;
  ani: Set<number>;
}

function isReferenced(rec: MangabakaRoot, refs: RefSets): boolean {
  const mb = num(rec.id);
  if (mb && refs.mb.has(mb)) return true;
  const mal = num(rec.source?.my_anime_list?.id);
  if (mal && refs.mal.has(mal)) return true;
  const ani = num(rec.source?.anilist?.id);
  if (ani && refs.ani.has(ani)) return true;
  return false;
}

function shouldKeep(rec: MangabakaRoot, refs: RefSets, now: number): boolean {
  if ((rec.content_rating || "").toLowerCase() === "erotica") return false;
  if (isReferenced(rec, refs)) return true;
  if (rec.state && rec.state !== "active") return false;
  const popular = rec.popularity?.global?.current;
  if (typeof popular === "number" && popular <= POPULARITY_CUTOFF) return true;
  if (typeof rec.rating === "number" && rec.rating >= RATING_FLOOR) return true;
  const year = num(rec.year) ?? parseYear(rec.published?.start_date);
  if (typeof year === "number" && year >= RECENT_YEAR) return true;
  if (rec.last_updated_at) {
    const t = Date.parse(rec.last_updated_at);
    if (!Number.isNaN(t) && now - t <= RECENT_MS) return true;
  }
  return false;
}

class JsonLineSplitter extends Transform {
  private buf = "";
  constructor() {
    super({ readableObjectMode: true });
  }
  _transform(chunk: Buffer, _enc: string, cb: (err?: Error | null) => void) {
    this.buf += chunk.toString("utf8");
    let idx: number;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, idx).replace(/\r$/, "");
      this.buf = this.buf.slice(idx + 1);
      if (line.trim()) this.push(line);
    }
    cb();
  }
  _flush(cb: (err?: Error | null) => void) {
    if (this.buf.trim()) this.push(this.buf.trim());
    cb();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === "true";
  const limit = Number(args["limit"] ?? "0") || 0;
  const maxRecords = Number(args["max-records"] ?? "0") || 0;
  const url = args["url"] || DEFAULT_URL;
  const localPath = args["file"];

  loadEnvFile(path.resolve(process.cwd(), "apps/web/.env"));
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Expected apps/web/.env");
    process.exit(1);
  }

  const sqlClient = postgres(process.env.DATABASE_URL, { max: 2, prepare: false });
  const db = drizzle(sqlClient, { schema });

  // refs
  const refs: RefSets = { mb: new Set(), mal: new Set(), ani: new Set() };
  try {
    const [titles, entries] = await Promise.all([
      db.select({ malId: schema.titles.malId }).from(schema.titles).where(isNotNull(schema.titles.malId)),
      db
        .select({
          provider: schema.providerEntries.provider,
          externalId: schema.providerEntries.externalId,
          malId: schema.providerEntries.malId,
          anilistId: schema.providerEntries.anilistId,
        })
        .from(schema.providerEntries),
    ]);
    for (const { malId } of titles) if (malId != null) refs.mal.add(malId);
    for (const e of entries) {
      if (e.malId != null) refs.mal.add(e.malId);
      if (e.anilistId != null) refs.ani.add(e.anilistId);
      if (e.provider.toLowerCase() === "mangabaka") {
        const mb = Number.parseInt(e.externalId, 10);
        if (Number.isFinite(mb)) refs.mb.add(mb);
      }
    }
  } catch (e) {
    console.warn("ref load skipped:", (e as Error).message);
  }
  console.log(`refs: mb=${refs.mb.size} mal=${refs.mal.size} ani=${refs.ani.size}`);

  let stream: NodeJS.ReadableStream;
  if (localPath && fs.existsSync(localPath)) {
    console.log(`using local file: ${localPath}`);
    stream = fs.createReadStream(localPath);
  } else {
    console.log(`downloading: ${url}`);
    stream = await openTarGzFromUrl(url);
  }

  const member = await extractTarGzMember(stream, MEMBER_NAME);
  if (!member) throw new Error(`member ${MEMBER_NAME} not found in tar`);
  console.log(`member: ${MEMBER_NAME}`);

  const splitter = new JsonLineSplitter();
  let now = Date.now();
  let scanned = 0;
  let kept = 0;
  let filtered = 0;
  let jsonErr = 0;
  let inserted = 0;
  const rows: any[] = [];

  async function flush() {
    const valid = rows.filter((r) => r.id != null && r.id > 0);
    if (!valid.length) {
      rows.length = 0;
      return false;
    }
    if (dryRun) {
      inserted += valid.length;
    } else {
      const ok = await upsertMangabakaSeries(db, valid);
      if (ok !== valid.length) throw new Error(`${ok}/${valid.length}`);
      inserted += valid.length;
    }
    rows.length = 0;
    return limit && inserted >= limit;
  }

  await pipeline(member, splitter, async function* (src) {
    for await (const line of src as AsyncIterable<string>) {
      let rec: MangabakaRoot;
      try {
        rec = JSON.parse(line) as MangabakaRoot;
      } catch {
        jsonErr++;
        continue;
      }
      scanned++;
      if (shouldKeep(rec, refs, now)) {
        // Enforce --limit exactly, including when it is not a multiple of BATCH_SIZE.
        // The old batch-only check could overshoot the requested count by up to 499 rows.
        if (limit && inserted + rows.length >= limit) break;
        rows.push(toMangabakaSeriesRow(rec));
        kept++;
        if (rows.length >= BATCH_SIZE) {
          const done = await flush();
          if (done) return;
        }
      } else {
        filtered++;
      }
      if (scanned % 50000 === 0) {
        console.log(`scan=${scanned} kept=${kept} filtered=${filtered} ins=${inserted} err=${jsonErr}`);
      }
      if (maxRecords && scanned >= maxRecords) break;
      if (limit && inserted >= limit) break;
    }
    await flush();
  });

  console.log(`done: scan=${scanned} kept=${kept} filtered=${filtered} err=${jsonErr} inserted=${inserted}`);
  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});