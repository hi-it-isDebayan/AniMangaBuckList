/**
 * SSRF guards for source health checks.
 *
 * Health checks and "link & test" fetches run from the server, so a user
 * supplied URL must never be allowed to reach internal infrastructure
 * (loopback, private ranges, link-local / cloud metadata, etc.).
 *
 * These helpers are intentionally pure so they can be unit tested without
 * touching the network. The DNS-resolving fetch helper reuses them after
 * resolving and after every redirect hop.
 */

/** Parse a dotted-quad IPv4 string into an unsigned 32-bit integer. */
export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

interface Cidr4 {
  base: number;
  bits: number;
}

function cidr4(cidr: string): Cidr4 {
  const [addr, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  return { base: ipv4ToInt(addr) ?? 0, bits };
}

function inCidr4(value: number, cidr: Cidr4): boolean {
  if (cidr.bits === 0) return true;
  const mask = (0xffffffff << (32 - cidr.bits)) >>> 0;
  return (value & mask) === (cidr.base & mask);
}

/** Ranges that must never be fetched on behalf of a user. */
const BLOCKED_IPV4: Cidr4[] = [
  "0.0.0.0/8", // "this network"
  "10.0.0.0/8", // private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (incl. 169.254.169.254 metadata)
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved / broadcast
].map(cidr4);

export function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return BLOCKED_IPV4.some((range) => inCidr4(value, range));
}

/** Very small IPv6 classifier: loopback, unspecified, ULA, link-local, multicast. */
export function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("ff")) return true;
  // IPv4-mapped (::ffff:a.b.c.d) — defer to the IPv4 table.
  const mapped = normalized.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  if (ip.includes(":")) return isBlockedIpv6(ip);
  return isBlockedIpv4(ip);
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return host === "local" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost");
}

export interface UrlSafetyResult {
  ok: boolean;
  reason?: string;
  /** The literal IP form when the hostname is an IP address. */
  literalIp?: string;
}

function looksLikeIpv4(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

export function ipv4LiteralToDotted(value: string): string | null {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return parts.join(".");
}

/** Static (non-DNS) SSRF validation of a URL. */
export function assertSafeUrlShape(input: string | URL): UrlSafetyResult {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return { ok: false, reason: "Invalid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs can be checked." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not allowed." };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, reason: "URL is missing a host." };

  if (isBlockedHostname(host)) {
    return { ok: false, reason: "That host is not allowed." };
  }

  if (host.includes(":")) {
    if (isBlockedIpv6(host)) return { ok: false, reason: "That address is not allowed." };
    return { ok: true, literalIp: host };
  }

  if (looksLikeIpv4(host)) {
    if (isBlockedIpv4(host)) return { ok: false, reason: "That address is not allowed." };
    return { ok: true, literalIp: host };
  }

  return { ok: true };
}

/**
 * Validate a URL whose hostname has already been resolved to `addresses`.
 * Every resolved address must be public, otherwise the target is rejected.
 */
export function assertResolvedAddressesPublic(addresses: string[]): UrlSafetyResult {
  if (addresses.length === 0) {
    return { ok: false, reason: "Could not resolve that host." };
  }
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      return { ok: false, reason: "That host resolves to a non-public address." };
    }
  }
  return { ok: true };
}
