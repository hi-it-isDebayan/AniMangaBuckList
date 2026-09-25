const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  baseUrl: "https://animanga.debayandas.in",
  apiKey: "",
  enabled: true
};

function readConfig() {
  chrome.storage.local.get(DEFAULTS, renderConfig);
}

function renderConfig(c) {
  if ($("#enabled")) $("#enabled").checked = !!c.enabled;
  if ($("#apiKey")) $("#apiKey").value = c.apiKey;
  if ($("#baseUrl")) $("#baseUrl").value = c.baseUrl;
  if ($("#status")) $("#status").textContent = keyLabel(c.apiKey);
}

function maskKey(k) {
  if (!k) return "";
  if (k.length <= 6) return k[0] + "***";
  return k.slice(0, 5) + "\u2026" + k.slice(-4) + " (" + k.length + " chars)";
}

function keyLabel(k) {
  return k ? "Stored: " + maskKey(k) + " \u2014 click Test after saving changes" : "No key yet";
}

function save() {
  const payload = {
    baseUrl: $("#baseUrl").value.trim().replace(/\/+$/, ""),
    apiKey: $("#apiKey").value.trim(),
    enabled: $("#enabled").checked
  };
  chrome.runtime.sendMessage({ type: "SET_CONFIG", payload: payload }, () => {
    $("#status").textContent = payload.apiKey ? "Saved" : "Saved (no key)";
    loadLibrary();
    loadPending();
    loadLog();
  });
}

function testExtension() {
  $("#status").textContent = "Testing...";
  const payload = {
    baseUrl: $("#baseUrl").value.trim().replace(/\/+$/, ""),
    apiKey: $("#apiKey").value.trim(),
    enabled: $("#enabled").checked
  };
  chrome.runtime.sendMessage({ type: "SET_CONFIG", payload: payload }, () => {
    chrome.runtime.sendMessage({ type: "TEST_EXTENSION" }, (res) => {
      $("#status").textContent = (res && res.detail) || "No response from background";
      loadLog();
    });
  });
}

function loadLog() {
  const wrap = $("#logWrap");
  if (!wrap) return;
  chrome.runtime.sendMessage({ type: "GET_LOG" }, (res) => {
    const log = (res && res.log) || [];
    wrap.textContent = "";
    if (!log.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No activity yet. Open a chapter/episode page while reading, then check here.";
      wrap.appendChild(empty);
      return;
    }
    log.slice(-40).forEach((e) => {
      const row = document.createElement("div");
      row.className = "log-line";
      const tm = document.createElement("span");
      tm.className = "t";
      tm.textContent = new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const msg = document.createElement("span");
      msg.textContent = e.msg;
      row.append(tm, msg);
      wrap.appendChild(row);
    });
  });
}

function loadLibrary() {
  const list = $("#list");
  if (!list) return;
  list.textContent = "";
  const setCount = (v) => { if ($("#count")) $("#count").textContent = v; };
  setCount("...");
  chrome.runtime.sendMessage({ type: "GET_LIBRARY" }, (res) => {
    if (!res || !res.ok) {
      setCount("-");
      const li = document.createElement("li");
      li.className = "err";
      const err = (res && res.error) || "unknown";
      li.textContent = err === "no-key" ? "No API key set. Add one above." : err === "network" ? "Network error." : "Error: " + err;
      list.appendChild(li);
      return;
    }
    const items = (res.data && res.data.items) || [];
    const tracked = items.filter((it) => isTracked(it));
    setCount(tracked.length + "/" + items.length);
    if (!tracked.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No tracked progress yet.";
      list.appendChild(li);
      return;
    }
    tracked.slice(0, 50).forEach((it) => list.appendChild(itemRow(it)));
  });
}

function isTracked(it) {
  const p = it.progress || {};
  return !!(p.lastOpenedChapter || p.lastCompletedChapter || p.lastOpenedEpisode || p.lastCompletedEpisode);
}

function itemRow(it) {
  const li = document.createElement("li");
  const t = (it.title && (it.title.primaryTitle || it.title.englishTitle)) || "Untitled";
  const media = (it.title && it.title.mediaType) || "";

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = media;

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = t;

  const line = document.createElement("div");
  line.className = "line";
  line.textContent = progressLine(it.progress);

  li.append(tag, name, line);
  return li;
}

function progressLine(p) {
  if (!p) return "-";
  const parts = [];
  if (p.lastOpenedChapter) parts.push("read up to ch. " + p.lastOpenedChapter);
  if (p.lastCompletedChapter) parts.push("finished ch. " + p.lastCompletedChapter);
  if (p.lastOpenedEpisode) parts.push("watched up to ep. " + p.lastOpenedEpisode);
  if (p.lastCompletedEpisode) parts.push("finished ep. " + p.lastCompletedEpisode);
  return parts.join(" - ") || "-";
}

function loadPending() {
  const card = $("#pendingCard");
  if (!card) return;
  chrome.runtime.sendMessage({ type: "GET_PENDING" }, (res) => {
    const items = (res && res.items) || [];
    const wrap = $("#pendingWrap");
    if ($("#pendingCount")) $("#pendingCount").textContent = items.length;
    card.hidden = items.length === 0;
    if (!wrap) return;
    wrap.textContent = "";
    items.forEach((it) => wrap.appendChild(pendingItem(it)));
  });
}

function pendingItem(it) {
  const d = it.detected || {};
  const box = document.createElement("div");
  box.className = "pending";

  const title = document.createElement("div");
  title.className = "pending-title";
  title.textContent = (d.title || d.normalized || "Unknown") + "  \u00b7  " + (d.unit ? d.unit.toLowerCase() : "?") + " " + d.value;

  const sub = document.createElement("div");
  sub.className = "muted";
  sub.textContent = (d.host || "a website") + "  \u00b7  detected as \u201C" + d.normalized + "\u201D";

  const searchRow = document.createElement("div");
  searchRow.className = "row search-row";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search your library...";
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(input.value); });
  const searchBtn = document.createElement("button");
  searchBtn.textContent = "Search";
  searchBtn.addEventListener("click", () => doSearch(input.value));
  searchRow.append(input, searchBtn);

  const results = document.createElement("div");
  results.className = "search-results";

  function doSearch(q) {
    if (!q.trim()) return;
    results.textContent = "";
    chrome.runtime.sendMessage({ type: "RESOLVE_SEARCH", q: q.trim(), unit: d.unit || "CHAPTER" }, (r) => {
      const cands = (r && r.ok && r.data && r.data.candidates) || [];
      if (!cands.length) {
        const none = document.createElement("div");
        none.className = "muted";
        none.textContent = "No matches \u2014 add this title on the website first.";
        results.appendChild(none);
        return;
      }
      cands.forEach((c) => results.appendChild(confirmBtn(c, c.primaryTitle)));
    });
  }

  const manualRow = document.createElement("div");
  manualRow.className = "row search-row";
  const manualInput = document.createElement("input");
  manualInput.type = "text";
  manualInput.placeholder = "Detected title (editable)...";
  manualInput.value = d.title || "";
  manualInput.addEventListener("keydown", (e) => { if (e.key === "Enter") manualInput.blur(); });
  const useBtn = document.createElement("button");
  useBtn.textContent = "Log it";
  useBtn.addEventListener("click", () => {
    const label = manualInput.value.trim();
    if (!label) return;
    results.textContent = "";
    chrome.runtime.sendMessage({ type: "RESOLVE_SEARCH", q: label, unit: d.unit || "CHAPTER" }, (r) => {
      const cands = (r && r.ok && r.data && r.data.candidates) || [];
      if (!cands.length) {
        const none = document.createElement("div");
        none.className = "muted";
        none.textContent = "No matching title in your library \u2014 add it on the website first.";
        results.appendChild(none);
        return;
      }
      cands.forEach((c) => results.appendChild(confirmBtn(c, c.primaryTitle)));
    });
  });
  manualRow.append(manualInput, useBtn);

  const dismiss = document.createElement("button");
  dismiss.className = "ghost";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "DISMISS_PENDING", dedupeKey: it.dedupeKey }, () => loadPending());
  });

  function confirmBtn(c, label) {
    const b = document.createElement("button");
    b.textContent = (label || c.primaryTitle) + (c.score ? "  (" + Math.round(c.score * 100) + "%)" : "");
    b.addEventListener("click", () => confirmMatch(c, label));
    return b;
  }

  function confirmMatch(c, label) {
    const payload = {
      titleId: c.titleId,
      detectedTitle: manualInput.value.trim() || d.title || label || c.primaryTitle,
      titleCandidates: (d.titleCandidates || []).concat([d.title, label, manualInput.value]).filter(Boolean).slice(0, 10),
      unit: d.unit || "CHAPTER",
      value: d.value,
      kind: d.kind || "OPENED",
      source: d.source,
      sourceUrl: d.sourceUrl,
      host: d.host
    };
    chrome.runtime.sendMessage({ type: "CONFIRM_PROGRESS", payload, dedupeKey: it.dedupeKey }, (res) => {
      if (res && res.ok) {
        loadPending();
        loadLibrary();
      }
    });
  }

  box.append(title, sub, searchRow, results, manualRow, dismiss);
  return box;
}

const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
on("save", "click", save);
on("test", "click", testExtension);
on("refresh", "click", loadLibrary);
on("enabled", "change", save);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

readConfig();
loadLibrary();
loadPending();
loadLog();