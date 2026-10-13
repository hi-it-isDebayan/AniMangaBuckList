/**
 * Failure categorization.
 *
 * Health reporting only ever stores a sanitized category — never raw upstream
 * error text, response bodies, stack traces, or URLs with session data.
 */
import type { SourceFailureCategory } from "@ambl/database";

export function categorizeHttpStatus(status: number): SourceFailureCategory {
  if (status >= 500) return "HTTP_5XX";
  if (status >= 400) return "HTTP_4XX";
  return "NONE";
}

interface ErrorLike {
  name?: string;
  code?: string;
  message?: string;
}

/** Map a thrown fetch/undici error to a stable, non-sensitive category. */
export function categorizeFetchError(error: unknown): SourceFailureCategory {
  const err = (error ?? {}) as ErrorLike;
  const code = (err.code ?? "").toUpperCase();
  const message = (err.message ?? "").toLowerCase();

  if (
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    message.includes("timeout")
  ) {
    return "TIMEOUT";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS";
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code.startsWith("ERR_TLS") ||
    message.includes("certificate")
  ) {
    return "TLS";
  }
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EPIPE") return "BLOCKED";
  if (message.includes("redirect")) return "TOO_MANY_REDIRECTS";
  if (message.includes("not allowed") || message.includes("non-public")) return "UNSAFE_TARGET";
  return "UNKNOWN";
}

const CATEGORY_LABELS: Record<SourceFailureCategory, string> = {
  NONE: "No problem recorded",
  TIMEOUT: "Timed out",
  DNS: "Domain did not resolve",
  TLS: "TLS/certificate problem",
  HTTP_4XX: "Page rejected the request",
  HTTP_5XX: "Site returned a server error",
  BLOCKED: "Connection refused or reset",
  TOO_MANY_REDIRECTS: "Too many redirects",
  PARSE_MISMATCH: "Content could not be read",
  UNSAFE_TARGET: "Target is not a public web address",
  UNKNOWN: "Unknown problem",
};

export function failureCategoryLabel(category: SourceFailureCategory): string {
  return CATEGORY_LABELS[category] ?? CATEGORY_LABELS.UNKNOWN;
}
