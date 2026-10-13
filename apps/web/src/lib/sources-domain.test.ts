import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalDomain, parseSourceUrl } from "./sources/domain";

test("canonicalDomain lowercases, strips trailing dot and www/m/mobile", () => {
  assert.equal(canonicalDomain("WWW.Example.com."), "example.com");
  assert.equal(canonicalDomain("m.example.com"), "example.com");
  assert.equal(canonicalDomain("mobile.example.com"), "example.com");
  assert.equal(canonicalDomain("example.com"), "example.com");
});

test("canonicalDomain keeps distinct subdomains distinct", () => {
  assert.equal(canonicalDomain("a.example.com"), "a.example.com");
  assert.equal(canonicalDomain("b.example.com"), "b.example.com");
  assert.notEqual(canonicalDomain("a.example.com"), canonicalDomain("b.example.com"));
});

test("canonicalDomain does not mangle multi-label public suffixes", () => {
  assert.equal(canonicalDomain("www.example.co.uk"), "example.co.uk");
  assert.equal(canonicalDomain("example.co.uk"), "example.co.uk");
});

test("canonicalDomain converts IDN hosts to punycode", () => {
  assert.equal(canonicalDomain("münchen.de"), "xn--mnchen-3ya.de");
});

test("canonicalDomain returns null for empty input", () => {
  assert.equal(canonicalDomain("   "), null);
  assert.equal(canonicalDomain("."), null);
});

test("parseSourceUrl adds https, drops query/fragment and trailing slash", () => {
  const result = parseSourceUrl("Example.com/read/?utm_source=x#frag");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.domain, "example.com");
  assert.equal(result.value.homepageUrl, "https://example.com/read");
});

test("equivalent submissions collapse to the same domain (duplicate prevention)", () => {
  const a = parseSourceUrl("www.Example.com");
  const b = parseSourceUrl("https://example.com/");
  const c = parseSourceUrl("http://m.example.com/?ref=1");
  assert.equal(a.ok && b.ok && c.ok, true);
  if (!a.ok || !b.ok || !c.ok) return;
  assert.equal(a.value.domain, b.value.domain);
  assert.equal(b.value.domain, c.value.domain);
});

test("parseSourceUrl rejects non-http(s) and credentialed URLs", () => {
  assert.equal(parseSourceUrl("ftp://example.com").ok, false);
  assert.equal(parseSourceUrl("http://user:pass@example.com").ok, false);
  assert.equal(parseSourceUrl("javascript:alert(1)").ok, false);
  assert.equal(parseSourceUrl("").ok, false);
});
