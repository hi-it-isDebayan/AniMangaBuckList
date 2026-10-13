/**
 * SSRF-safe page fetch used by "link & test" and health checks.
 *
 * Every hop (initial URL and each redirect target) is re-validated:
 *   1. static shape checks (`assertSafeUrlShape`) — scheme, credentials, host,
 *      literal private/loopback/link-local/metadata addresses;
 *   2. DNS resolution of the host, rejecting any non-public resolved address.
 *
 * Redirects are followed manually and never trusted blindly. `fetchImpl` and
 * `resolveHost` are injectable so the logic is unit-testable without a network.
 *
 * Limitation: because TLS SNI must match the hostname we keep the hostname in
 * the request rather than pinning the resolved IP, so a host that answers with a
 * different address between the DNS check and the connection (DNS rebinding) is
 * not fully prevented. Redirect hops are re-resolved and re-validated, and
 * literal internal addresses are always rejected.
 */
import { lookup } from "node:dns/promises";
import type { SourceFailureCategory } from "@ambl/database";
import { categorizeFetchError, categorizeHttpStatus } from "./failure";
import { assertSafeUrlShape, assertResolvedAddressesPublic } from "./ssrf";

export const SAFE_FETCH_USER_AGENT =
  "AniMangaBuckListSourceBot/1.0 (+https://github.com/hi-it-isDebayan/AniMangaBuckList)";

export type HostResolver = (hostname: string) => Promise<string[]>;

export interface SafeFetchOptions {
  fetchImpl?: typeof fetch;
  resolveHost?: HostResolver;
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResult {
  /** True when we received an HTTP response at all (even 4xx/5xx). */
  reachable: boolean;
  /** True for a final 2xx/3xx response. */
  ok: boolean;
  status: number | null;
  finalUrl: string;
  body: string | null;
  /** Sanitized category; never raw upstream text. */
  category: SourceFailureCategory;
  latencyMs: number;
}

const DEFAULTS = {
  maxRedirects: 5,
  timeoutMs: 15_000,
  maxBytes: 2_000_000,
};

const TEXTISH = /text\/html|text\/plain|application\/xhtml|application\/xml|application\/json|\+xml/i;

const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isLiteralAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return IPV4_LITERAL.test(host) || host.includes(":");
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

interface HostCheck {
  ok: boolean;
  category?: SourceFailureCategory;
}

async function validateHost(
  hostname: string,
  resolveHost: HostResolver,
): Promise<HostCheck> {
  if (isLiteralAddress(hostname)) {
    // Literal IPs were already classified by assertSafeUrlShape.
    return { ok: true };
  }
  let addresses: string[];
  try {
    addresses = await resolveHost(hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return { ok: false, category: "DNS" };
  }
  if (addresses.length === 0) return { ok: false, category: "DNS" };
  const check = assertResolvedAddressesPublic(addresses);
  if (!check.ok) return { ok: false, category: "UNSAFE_TARGET" };
  return { ok: true };
}

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !TEXTISH.test(contentType)) return null;
  const body = response.body;
  if (!body) {
    const text = await response.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - total;
      if (remaining <= 0) break;
      chunks.push(value.byteLength > remaining ? value.subarray(0, remaining) : value);
      total += Math.min(value.byteLength, remaining);
      if (total >= maxBytes) break;
    }
  } catch {
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function failure(
  category: SourceFailureCategory,
  latencyMs: number,
  finalUrl: string,
  status: number | null = null,
): SafeFetchResult {
  return { reachable: false, ok: false, status, finalUrl, body: null, category, latencyMs };
}

export async function fetchPageSafely(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const elapsed = () => Date.now() - startedAt;

  const shape = assertSafeUrlShape(rawUrl);
  if (!shape.ok) {
    return failure("UNSAFE_TARGET", elapsed(), typeof rawUrl === "string" ? rawUrl : "");
  }

  let current = new URL(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const hostCheck = await validateHost(current.hostname, resolveHost);
    if (!hostCheck.ok) {
      return failure(hostCheck.category ?? "UNSAFE_TARGET", elapsed(), current.toString());
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": SAFE_FETCH_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
    } catch (error) {
      clearTimeout(timer);
      return failure(categorizeFetchError(error), elapsed(), current.toString());
    }
    clearTimeout(timer);

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) break;
      if (hop === maxRedirects) {
        return failure("TOO_MANY_REDIRECTS", elapsed(), current.toString(), response.status);
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return failure("TOO_MANY_REDIRECTS", elapsed(), current.toString(), response.status);
      }
      const nextShape = assertSafeUrlShape(next);
      if (!nextShape.ok) {
        return failure("UNSAFE_TARGET", elapsed(), next.toString(), response.status);
      }
      current = next;
      continue;
    }

    const body = await readCapped(response, maxBytes);
    const ok = response.status >= 200 && response.status < 400;
    return {
      reachable: true,
      ok,
      status: response.status,
      finalUrl: current.toString(),
      body,
      category: categorizeHttpStatus(response.status),
      latencyMs: elapsed(),
    };
  }

  return failure("TOO_MANY_REDIRECTS", elapsed(), current.toString());
}
