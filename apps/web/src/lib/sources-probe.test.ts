import assert from "node:assert/strict";
import { test } from "node:test";
import { probeSource } from "./sources/probe";

const publicResolver = async () => ["93.184.216.34"];

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () => htmlResponse(body, status)) as unknown as typeof fetch;
}

test("reachability and extraction compatibility are reported separately", async () => {
  const probe = await probeSource("https://example.com/series/solo-leveling/chapter-12", {
    resolveHost: async () => ["93.184.216.34"],
    fetchImpl: fakeFetch(
      '<html><head><meta property="og:title" content="Solo Leveling Chapter 12" /></head></html>',
    ),
  });
  assert.equal(probe.reachable, true);
  assert.equal(probe.extractOk, true);
  assert.equal(probe.category, "NONE");
  assert.equal(probe.title, "Solo Leveling");
  assert.equal(probe.unit, "CHAPTER");
  assert.equal(probe.value, 12);
});

test("a reachable page with no identifiable content is a PARSE_MISMATCH", async () => {
  const probe = await probeSource("https://example.com/", {
    resolveHost: async () => ["93.184.216.34"],
    fetchImpl: fakeFetch("<html><body>nothing to see</body></html>"),
  });
  assert.equal(probe.reachable, true);
  assert.equal(probe.extractOk, false);
  assert.equal(probe.category, "PARSE_MISMATCH");
});

test("an HTTP error surfaces the HTTP category, not a parse error", async () => {
  const probe = await probeSource("https://example.com/", {
    resolveHost: async () => ["93.184.216.34"],
    fetchImpl: fakeFetch("gone", 404),
  });
  assert.equal(probe.reachable, true);
  assert.equal(probe.extractOk, false);
  assert.equal(probe.httpStatus, 404);
  assert.equal(probe.category, "HTTP_4XX");
});

test("an unreachable target reports the sanitized reason", async () => {
  const probe = await probeSource("https://sneaky.example/", {
    resolveHost: async () => ["10.0.0.9"],
    fetchImpl: fakeFetch("<html></html>"),
  });
  assert.equal(probe.reachable, false);
  assert.equal(probe.extractOk, false);
  assert.equal(probe.category, "UNSAFE_TARGET");
  assert.ok(probe.detail.length > 0);
});
