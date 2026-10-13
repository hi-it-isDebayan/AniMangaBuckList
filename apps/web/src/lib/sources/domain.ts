/**
 * Canonicalization for source URLs.
 *
 * Duplicate prevention for the community source directory relies on reducing
 * every submitted URL to a single canonical `domain` string. Two URLs that
 * differ only by scheme, case, a trailing dot, a leading `www`/`m`/`mobile`
 * label, or tracking query parameters must collapse to the same value.
 *
 * This intentionally does NOT ship a Public Suffix List: it strips a small set
 * of well-known host labels. Distinct hosts such as `a.example.com` and
 * `b.example.com` stay distinct, which is correct — they are different hosts.
 */

export interface CanonicalSource {
  /** Canonical host used as the dedupe key (e.g. `example.com`). */
  domain: string;
  /** Canonical homepage URL (query/fragment stripped). */
  homepageUrl: string;
}

export type ParseSourceUrlResult =
  | { ok: true; value: CanonicalSource }
  | { ok: false; reason: string };

const HOST_LABELS_TO_STRIP = new Set(["www", "m", "mobile"]);

/** Lowercase, punycode, no trailing dot, and drop a leading www/m/mobile label. */
export function canonicalDomain(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/\.+$/, "");
  if (!host) return null;

  let ascii: string;
  try {
    // `URL` performs IDNA/punycode conversion for us.
    ascii = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!ascii) return null;

  const labels = ascii.split(".").filter(Boolean);
  if (labels.length > 2 && HOST_LABELS_TO_STRIP.has(labels[0])) {
    labels.shift();
  }
  return labels.join(".");
}

export function canonicalizeHomepage(url: URL): string {
  const clean = new URL(url.toString());
  clean.search = "";
  clean.hash = "";
  // Normalize `https://example.com` and `https://example.com/` to one form.
  if (clean.pathname !== "/") {
    clean.pathname = clean.pathname.replace(/\/+$/, "");
  }
  return clean.toString();
}

export function parseSourceUrl(raw: string): ParseSourceUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Enter a website URL." };

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "That does not look like a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs are supported." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs that contain credentials are not allowed." };
  }

  const domain = canonicalDomain(url.hostname);
  if (!domain) {
    return { ok: false, reason: "Could not read the domain from that URL." };
  }

  return { ok: true, value: { domain, homepageUrl: canonicalizeHomepage(url) } };
}

/** True when two raw URLs point at the same canonical source. */
export function sameSource(a: string, b: string): boolean {
  const da = parseSourceUrl(a);
  const db = parseSourceUrl(b);
  if (!da.ok || !db.ok) return false;
  return da.value.domain === db.value.domain;
}
