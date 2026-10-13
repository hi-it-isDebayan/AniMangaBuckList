import assert from "node:assert/strict";
import { test } from "node:test";
import { categorizeFetchError, categorizeHttpStatus, failureCategoryLabel } from "./sources/failure";
import type { SourceFailureCategory } from "@ambl/database";

test("HTTP statuses map to sanitized categories", () => {
  assert.equal(categorizeHttpStatus(404), "HTTP_4XX");
  assert.equal(categorizeHttpStatus(403), "HTTP_4XX");
  assert.equal(categorizeHttpStatus(500), "HTTP_5XX");
  assert.equal(categorizeHttpStatus(503), "HTTP_5XX");
  assert.equal(categorizeHttpStatus(200), "NONE");
});

test("network errors map to categories without leaking detail", () => {
  assert.equal(categorizeFetchError({ code: "ENOTFOUND" }), "DNS");
  assert.equal(categorizeFetchError({ code: "EAI_AGAIN" }), "DNS");
  assert.equal(categorizeFetchError({ code: "ETIMEDOUT" }), "TIMEOUT");
  assert.equal(categorizeFetchError({ name: "AbortError" }), "TIMEOUT");
  assert.equal(categorizeFetchError({ code: "ECONNREFUSED" }), "BLOCKED");
  assert.equal(categorizeFetchError({ code: "ECONNRESET" }), "BLOCKED");
  assert.equal(categorizeFetchError({ code: "CERT_HAS_EXPIRED" }), "TLS");
  assert.equal(categorizeFetchError({ message: "too many redirects" }), "TOO_MANY_REDIRECTS");
  assert.equal(categorizeFetchError({ message: "address is not allowed" }), "UNSAFE_TARGET");
  assert.equal(categorizeFetchError({}), "UNKNOWN");
  assert.equal(categorizeFetchError(null), "UNKNOWN");
});

test("every category has a human label", () => {
  const categories: SourceFailureCategory[] = [
    "NONE",
    "TIMEOUT",
    "DNS",
    "TLS",
    "HTTP_4XX",
    "HTTP_5XX",
    "BLOCKED",
    "TOO_MANY_REDIRECTS",
    "PARSE_MISMATCH",
    "UNSAFE_TARGET",
    "UNKNOWN",
  ];
  for (const category of categories) {
    const label = failureCategoryLabel(category);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `${category} needs a label`);
  }
});
