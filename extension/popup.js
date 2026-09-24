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
  $("#enabled").checked = !!c.enabled;
  $("#apiKey").value = c.apiKey;
  $("#baseUrl").value = c.baseUrl;
  $("#status").textContent = c.apiKey ? "Key stored" : "No key yet";
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
  });
}

function loadLibrary() {
  const list = $("#list");
  list.textContent = "";
  $("#count").textContent = "...";
  chrome.runtime.sendMessage({ type: "GET_LIBRARY" }, (res) => {
    if (!res || !res.ok) {
      $("#count").textContent = "-";
      const li = document.createElement("li");
      li.className = "err";
      const err = (res && res.error) || "unknown";
      li.textContent = err === "no-key" ? "No API key set. Add one above." : err === "network" ? "Network error." : "Error: " + err;
      list.appendChild(li);
      return;
    }
    const items = (res.data && res.data.items) || [];
    const tracked = items.filter((it) => isTracked(it));
    $("#count").textContent = tracked.length + "/" + items.length;
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

$("#save").addEventListener("click", save);
$("#refresh").addEventListener("click", loadLibrary);
$("#enabled").addEventListener("change", save);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

readConfig();
loadLibrary();