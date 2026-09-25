const LAST_URL_KEY = "ambl-last-url";

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}

function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

function hasContext() {
  try {
    return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function getEnabled(cb) {
  if (!hasContext()) { cb(false); return; }
  try {
    chrome.storage.local.get({ enabled: true }, (cfg) => cb(!!cfg.enabled));
  } catch (e) {
    cb(false);
  }
}

const SKIP_HOSTS = new Set([
  "animanga.debayandas.in",
  "chrome.google.com",
  "chrome",
  "newtab",
]);

const UNIT_TOKENS = {
  CHAPTER: ["chapter", "chapters", "chap", "ch", "capitulo", "cap"],
  EPISODE: ["episode", "episodes", "ep", "episodio"],
};

function collectTextCandidates() {
  const out = [];
  const push = (v) => {
    const t = (v || "").replace(/\s+/g, " ").trim();
    if (t && t.length > 1) out.push(t);
  };

  push(document.title);

  document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach((el) => push(el.content));

  const h1 = document.querySelector("h1, .entry-title, .post-title, .read-title, .title");
  if (h1) push(h1.textContent);

  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const data = JSON.parse(s.textContent);
      const walk = (node) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node.name === "string") push(node.name);
        if (typeof node.headline === "string") push(node.headline);
        Object.values(node).forEach(walk);
      };
      walk(data);
    } catch (e) {}
  });

  return out;
}

function extractFromString(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  for (const unit of ["CHAPTER", "EPISODE"]) {
    for (const tok of UNIT_TOKENS[unit]) {
      const re = new RegExp(`(?:^|[^a-z0-9])${tok}[.\\s\\/-]*?(\\d{1,4})(?:$$|[^a-z0-9])`);
      const m = s.match(re);
      if (m) return { unit, value: parseInt(m[1], 10) };
    }
  }
  return null;
}

function extractTrailingNumber(url) {
  const pathname = (() => {
    try {
      return new URL(url).pathname.replace(/\/+$/, "");
    } catch (e) {
      return "";
    }
  })();
  const last = pathname.split("/").pop() || "";
  const m = last.match(/^(.*?)-(\d{1,5})$/);
  if (!m) return null;
  const num = parseInt(m[2], 10);
  const titlePart = m[1].trim();
  if (!titlePart || titlePart.length < 3 || !/[a-z]/i.test(titlePart)) return null;
  if (!/series|manga|manhwa|manhua|title|comic|chapter|reader|read|novel|comics|anime|watch|episode/i.test(pathname)) return null;
  return {
    unit: /episode|ep-|episode-|watch|anime|dub|sub/i.test(pathname) ? "EPISODE" : "CHAPTER",
    value: num,
  };
}

function extractUnitValue() {
  const url = location.href;
  const urlMatch = extractFromString(url);
  if (urlMatch) return urlMatch;
  const trailing = extractTrailingNumber(url);
  if (trailing) return trailing;
  const titleMatch = extractFromString(document.title);
  if (titleMatch) return titleMatch;
  const h1 = document.querySelector("h1, .entry-title, .post-title, .read-title");
  if (h1) {
    const h1Match = extractFromString(h1.textContent);
    if (h1Match) return h1Match;
  }
  const domMatch = findNumberInDom();
  if (domMatch) return domMatch;
  if (bodyScanCache.url !== url) {
    bodyScanCache = { url: url, result: scanBodyText() };
  }
  return bodyScanCache.result;
}

let bodyScanCache = { url: null, result: null };

function findNumberInDom() {
  const sel = [
    "h1", "h2", "h3", "h4",
    "[class*=chapter]", "[id*=chapter]",
    "[class*=episode]", "[id*=episode]",
    "[class*=chap-]", ".current", ".active",
    "[class*=nav] span", "[class*=nav] a",
    "a[href*=chapter]", "a[href*=episode]",
    "select option"
  ].join(",");
  let nodes = [];
  try { nodes = document.querySelectorAll(sel); } catch (e) {}
  for (const n of nodes) {
    const t = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (t && t.length < 120) {
      const r = extractFromString(t);
      if (r) return r;
    }
  }
  return null;
}

function scanBodyText() {
  try {
    const body = document.body;
    if (!body) return null;
    const text = (body.innerText || "").slice(0, 12000);
    return extractFromString(text);
  } catch (e) {
    return null;
  }
}

function pickBestTitle(candidates) {
  const cleaned = candidates
    .map((t) => t.replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 2);
  const ranked = cleaned
    .map((t) => ({
      t,
      hasJunk:
        t.includes("episode") ||
        t.includes("chapter") ||
        t.includes("ep ") ||
        t.includes("ch ") ||
        /[|•·]/.test(t),
    }))
    .sort((a, b) => Number(a.hasJunk) - Number(b.hasJunk));
  const seen = new Set();
  const result = [];
  for (const r of ranked) {
    const key = r.t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(r.t);
    }
  }
  return result;
}

function sendProgress(det, titleCandidates) {
  if (!hasContext()) return;
  const payload = {
    title: det.title,
    titleCandidates: (titleCandidates || []).slice(0, 10),
    unit: det.unit,
    value: det.value,
    kind: "OPENED",
    source: location.hostname,
    sourceUrl: location.href,
    host: location.hostname,
  };
  try {
    chrome.runtime.sendMessage({ type: "POST_PROGRESS", payload }, () => {});
  } catch (e) {}
}

function logEvent(msg) {
  if (!hasContext()) return;
  try {
    chrome.runtime.sendMessage({ type: "LOG_EVENT", msg }, () => {});
  } catch (e) {}
}

function tick() {
  getEnabled((enabled) => {
    if (!enabled) return;
    const host = location.hostname;
    if (SKIP_HOSTS.has(host)) return;
    try {
      const candidates = pickBestTitle(collectTextCandidates());
      const uv = extractUnitValue();
      if (!uv || !uv.value || uv.value <= 0) {
        const nowUrl = location.href;
        if (safeGet("ambl-last-skip-url") !== nowUrl) {
          safeSet("ambl-last-skip-url", nowUrl);
          logEvent("SKIP " + host + ": no chapter/episode number found in title/h1/url");
        }
        return;
      }

      const urlKey = location.href;
      if (urlKey === safeGet(LAST_URL_KEY)) return;
      safeSet(LAST_URL_KEY, urlKey);

      const title = candidates[0] || "Untitled";
      logEvent("DETECT " + title + " " + uv.unit + " " + uv.value + " @ " + host);
      sendProgress({ title: title, ...uv }, candidates);
    } catch (err) {
      try {
        logEvent("ERR " + host + ": " + ((err && err.message) ? err.message : String(err)));
      } catch (e2) {}
    }
  });
}

setInterval(tick, 2500);
tick();