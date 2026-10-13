/**
 * Link & test / health probe.
 *
 * Reachability and extraction compatibility are reported SEPARATELY:
 *  - `reachable` — we got an HTTP response from the site;
 *  - `extractOk`  — the generic extractor could identify page content.
 *
 * A site can be reachable but not extractable (PARSE_MISMATCH), or unreachable
 * for a category of reasons (timeout, DNS, TLS, ...). Only the sanitized
 * category is ever surfaced; raw upstream text is never stored or shown.
 */
import type { SourceFailureCategory } from "@ambl/database";
import { extractPage, type Unit } from "./extractors";
import { categorizeHttpStatus, failureCategoryLabel } from "./failure";
import { fetchPageSafely, type SafeFetchOptions } from "./safe-fetch";

export interface SourceProbeResult {
  reachable: boolean;
  extractOk: boolean;
  category: SourceFailureCategory;
  httpStatus: number | null;
  latencyMs: number;
  finalUrl: string;
  title: string | null;
  unit: Unit | null;
  value: number | null;
  /** Sanitized, user-facing explanation. */
  detail: string;
}

export async function probeSource(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SourceProbeResult> {
  const result = await fetchPageSafely(url, options);
  const base = {
    latencyMs: result.latencyMs,
    finalUrl: result.finalUrl,
    title: null as string | null,
    unit: null as Unit | null,
    value: null as number | null,
  };

  if (!result.reachable) {
    return {
      ...base,
      reachable: false,
      extractOk: false,
      category: result.category,
      httpStatus: result.status,
      detail: failureCategoryLabel(result.category),
    };
  }

  const status = result.status ?? 0;
  if (!result.ok) {
    const category = categorizeHttpStatus(status);
    return {
      ...base,
      reachable: true,
      extractOk: false,
      category,
      httpStatus: status,
      detail: `Site responded with HTTP ${status}.`,
    };
  }

  const extracted = extractPage(result.body ?? "", result.finalUrl);
  return {
    ...base,
    reachable: true,
    extractOk: extracted.ok,
    category: extracted.ok ? "NONE" : "PARSE_MISMATCH",
    httpStatus: status,
    title: extracted.title,
    unit: extracted.unit,
    value: extracted.value,
    detail: extracted.ok
      ? extracted.title
        ? `Reachable and content identified as “${extracted.title}”.`
        : "Reachable and content identified."
      : "Reached the site but could not identify chapter or episode content.",
  };
}
