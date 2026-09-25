const DEFAULTS = {
  baseUrl: "https://animanga.debayandas.in",
  apiKey: "",
  enabled: true
};

const PENDING_KEY = "ambl-pending";

function getConfig(cb) {
  chrome.storage.local.get(DEFAULTS, cb);
}

function apiFetch(path, options) {
  return new Promise((resolve) => {
    getConfig((config) => {
      if (!config.enabled) return resolve({ ok: false, error: "disabled" });
      if (!config.apiKey) return resolve({ ok: false, error: "no-key" });
      const headers = Object.assign(
        { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
        (options && options.headers) || {}
      );
      fetch(config.baseUrl + path, Object.assign({ headers: headers }, options)).then(
        (res) => {
          res
            .json()
            .then(
              (data) => {
                if (!res.ok && res.status !== 409)
                  return resolve({ ok: false, error: (data && data.error) || "http-" + res.status });
                resolve({ ok: res.ok, status: res.status, data: data });
              },
              () => resolve({ ok: false, error: "http-" + res.status })
            );
        },
        () => resolve({ ok: false, error: "network" })
      );
    });
  });
}

function loadPending(cb) {
  chrome.storage.local.get({ [PENDING_KEY]: [] }, (cfg) => cb(cfg[PENDING_KEY] || []));
}

function savePending(items, cb) {
  chrome.storage.local.set({ [PENDING_KEY]: items }, () => {
    updateBadge(items.length);
    if (cb) cb();
  });
}

function updateBadge(count) {
  chrome.action.setBadgeBackgroundColor({ color: "#6d5ce7" });
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
}

function addPending(detected) {
  loadPending((items) => {
    const dedupeKey = (detected.normalized || "") + "|" + detected.unit + "|" + detected.value;
    const exists = items.some((it) => it.dedupeKey === dedupeKey);
    if (exists) return;
    items.push({ dedupeKey, detected, url: detected.sourceUrl || "", at: Date.now() });
    items = items.slice(-20);
    savePending(items);
  });
}

function removePendingByKey(dedupeKey) {
  loadPending((items) => {
    savePending(items.filter((it) => it.dedupeKey !== dedupeKey));
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg && msg.type) {
    case "GET_CONFIG":
      getConfig((config) => sendResponse({ ok: true, data: { config: config } }));
      return true;
    case "SET_CONFIG":
      getConfig((config) => {
        const next = Object.assign({}, config, (msg.payload && typeof msg.payload === "object") ? msg.payload : {});
        chrome.storage.local.set(next, () => sendResponse({ ok: true }));
      });
      return true;
    case "GET_LIBRARY":
      apiFetch("/api/extension/library", { method: "GET" }).then(sendResponse);
      return true;
    case "POST_PROGRESS":
      apiFetch("/api/extension/progress", {
        method: "POST",
        body: JSON.stringify(msg.payload)
      }).then((res) => {
        if (res.status === 409 && res.data && res.data.needsConfirmation) {
          addPending(res.data.detected);
        }
        sendResponse(res);
      });
      return true;
    case "GET_PENDING":
      loadPending((items) => sendResponse({ ok: true, items }));
      return true;
    case "CONFIRM_PROGRESS":
      apiFetch("/api/extension/confirm", {
        method: "POST",
        body: JSON.stringify(msg.payload)
      }).then((res) => {
        if (res.ok && msg.dedupeKey) removePendingByKey(msg.dedupeKey);
        sendResponse(res);
      });
      return true;
    case "DISMISS_PENDING":
      removePendingByKey(msg.dedupeKey);
      sendResponse({ ok: true });
      return true;
    case "RESOLVE_SEARCH":
      {
        const q = encodeURIComponent(msg.q || "");
        const unit = encodeURIComponent(msg.unit || "CHAPTER");
        apiFetch("/api/extension/resolve?q=" + q + "&unit=" + unit, { method: "GET" }).then(sendResponse);
      }
      return true;
    default:
      return undefined;
  }
});