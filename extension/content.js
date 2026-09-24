const LAST_URL_KEY = "ambl-last-url";

function getEnabled(cb) {
  chrome.storage.local.get({ enabled: true }, (cfg) => cb(!!cfg.enabled));
}

function detectPage() {
  const path = location.pathname;
  const host = location.hostname;

  if (host === "myanimelist.net" || host === "www.myanimelist.net") {
    const m = path.match(/^\/(anime|manga)\/(\d+)/);
    if (!m) return null;
    const malId = +m[2];
    if (m[1] === "manga") return { malId, unit: "CHAPTER" };
    const ep = path.match(/(?:episode|ep)\/(\d+)/i);
    return { malId, unit: "EPISODE", value: ep ? +ep[1] : undefined };
  }

  if (host === "anilist.co" || host === "www.anilist.co") {
    const m = path.match(/^\/(anime|manga)\/(\d+)/);
    if (!m) return null;
    if (m[1] === "manga") return { unit: "CHAPTER" };
    return { unit: "EPISODE" };
  }

  if (host === "mangadex.org" || host.endsWith(".mangadex.org")) {
    return null;
  }

  return matchReader(path);
}

function matchReader(path) {
  const segs = path.split("/").filter(Boolean);
  for (let i = 1; i < segs.length; i++) {
    if (/^\d+$/.test(segs[i])) {
      const prev = (segs[i - 1] || "").toLowerCase();
      if (/^(chapter|chapters|ch|volume|vol)$/.test(prev)) return { unit: "CHAPTER", value: +segs[i] };
      if (/^(episode|episodes|ep|e)$/.test(prev)) return { unit: "EPISODE", value: +segs[i] };
    } else {
      const m = segs[i].match(/^(chapter|chapters|ch|episode|episodes|ep|volume|vol|v)[-_]?(\d+)$/i);
      if (!m) continue;
      const kw = m[1].toLowerCase();
      if (/^(chapter|chapters|ch)$/.test(kw)) return { unit: "CHAPTER", value: +m[2] };
      if (/^(episode|episodes|ep)$/.test(kw)) return { unit: "EPISODE", value: +m[2] };
      return { unit: null, value: +m[2] };
    }
  }
  return null;
}

function sendProgress(det) {
  const payload = {
    unit: det.unit,
    value: det.value,
    kind: "OPENED",
    source: location.hostname,
    sourceUrl: location.href
  };
  if (det.malId) payload.malId = det.malId;
  try {
    chrome.runtime.sendMessage({ type: "POST_PROGRESS", payload: payload }, () => {});
  } catch (e) {}
}

function tick() {
  getEnabled((enabled) => {
    if (!enabled) return;
    const det = detectPage();
    if (!det || !det.value || det.value <= 0 || !det.unit || !det.malId) return;
    if (location.href === localStorage.getItem(LAST_URL_KEY)) return;
    localStorage.setItem(LAST_URL_KEY, location.href);
    sendProgress(det);
  });
}

setInterval(tick, 2000);
tick();