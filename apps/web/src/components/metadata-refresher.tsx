"use client";

import { useEffect } from "react";

const STORAGE_KEY = "ambl:metadata-refresh-at";
const MIN_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Fire-and-forget metadata refresh when the app opens. Throttled in
 * localStorage so navigation and quick reloads do not hammer the provider.
 */
export function MetadataRefresher() {
  useEffect(() => {
    try {
      const last = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
      if (Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS) return;
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Private mode / storage disabled: still refresh once per mount.
    }

    void fetch("/api/metadata/refresh", {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).catch(() => {
      // Background refresh must never break the page.
    });
  }, []);

  return null;
}
