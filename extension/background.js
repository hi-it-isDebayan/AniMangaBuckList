const DEFAULTS = {
  baseUrl: "https://animanga.debayandas.in",
  apiKey: "",
  enabled: true
};

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
          res.json().then(
            (data) => {
              if (!res.ok) return resolve({ ok: false, error: (data && data.error) || "http-" + res.status });
              resolve({ ok: true, data: data });
            },
            () => resolve({ ok: false, error: "http-" + res.status })
          );
        },
        () => resolve({ ok: false, error: "network" })
      );
    });
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
      }).then(sendResponse);
      return true;
    default:
      return undefined;
  }
});