import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPageSafely } from "./sources/safe-fetch";

const publicResolver = async () => ["93.184.216.34"];

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function unusedFetch(): typeof fetch {
  return (async () => {
    throw new Error("fetch should not have been called");
  }) as unknown as typeof fetch;
}

test("literal metadata / loopback addresses are rejected before any fetch", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return htmlResponse("nope");
  }) as unknown as typeof fetch;

  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:6379/",
    "http://10.0.0.5/internal",
    "http://[::1]/",
  ]) {
    const result = await fetchPageSafely(url, { resolveHost: publicResolver, fetchImpl });
    assert.equal(result.reachable, false, url);
    assert.equal(result.category, "UNSAFE_TARGET", url);
  }
  assert.equal(called, false);
});

test("non-http(s), credentialed and malformed URLs are rejected", async () => {
  for (const url of ["ftp://example.com", "http://user:pass@example.com", "not a url"]) {
    const result = await fetchPageSafely(url, {
      resolveHost: publicResolver,
      fetchImpl: unusedFetch(),
    });
    assert.equal(result.reachable, false, url);
    assert.equal(result.category, "UNSAFE_TARGET", url);
  }
});

test("a public hostname that resolves to a private address is rejected", async () => {
  const result = await fetchPageSafely("https://sneaky.example/", {
    resolveHost: async () => ["10.1.2.3"],
    fetchImpl: unusedFetch(),
  });
  assert.equal(result.reachable, false);
  assert.equal(result.category, "UNSAFE_TARGET");
});

test("a normal public page is considered reachable and ok", async () => {
  const result = await fetchPageSafely("https://example.com/read", {
    resolveHost: publicResolver,
    fetchImpl: (async () => htmlResponse("<html><title>Hello</title></html>")) as unknown as typeof fetch,
  });
  assert.equal(result.reachable, true);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.category, "NONE");
  assert.match(result.body ?? "", /Hello/);
});

test("an HTTP error is reachable but not ok, with a sanitized category", async () => {
  const result = await fetchPageSafely("https://example.com/", {
    resolveHost: publicResolver,
    fetchImpl: (async () => htmlResponse("server error", 503)) as unknown as typeof fetch,
  });
  assert.equal(result.reachable, true);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.category, "HTTP_5XX");
});

test("non-text responses yield no body but stay reachable", async () => {
  const result = await fetchPageSafely("https://example.com/file.pdf", {
    resolveHost: publicResolver,
    fetchImpl: (async () =>
      new Response("%PDF-1.7", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      })) as unknown as typeof fetch,
  });
  assert.equal(result.reachable, true);
  assert.equal(result.body, null);
});

test("a redirect is followed, and the final URL is reported", async () => {
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://a.example/") {
      return new Response(null, { status: 301, headers: { location: "https://b.example/final" } });
    }
    return htmlResponse("<title>Done</title>");
  }) as unknown as typeof fetch;

  const result = await fetchPageSafely("https://a.example/", {
    resolveHost: publicResolver,
    fetchImpl,
  });
  assert.equal(result.ok, true);
  assert.equal(result.finalUrl, "https://b.example/final");
  assert.match(result.body ?? "", /Done/);
});

test("a redirect to an internal target is rejected", async () => {
  const fetchImpl = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data/" },
    })) as unknown as typeof fetch;

  const result = await fetchPageSafely("https://public.example/", {
    resolveHost: publicResolver,
    fetchImpl,
  });
  assert.equal(result.reachable, false);
  assert.equal(result.category, "UNSAFE_TARGET");
});

test("exceeding the redirect budget is reported, not followed forever", async () => {
  const fetchImpl = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://loop.example/next" },
    })) as unknown as typeof fetch;

  const result = await fetchPageSafely("https://loop.example/", {
    resolveHost: publicResolver,
    fetchImpl,
    maxRedirects: 2,
  });
  assert.equal(result.reachable, false);
  assert.equal(result.category, "TOO_MANY_REDIRECTS");
});

test("DNS failures and thrown fetch errors map to sanitized categories", async () => {
  const dns = await fetchPageSafely("https://missing.example/", {
    resolveHost: async () => {
      throw new Error("ENOTFOUND");
    },
    fetchImpl: unusedFetch(),
  });
  assert.equal(dns.category, "DNS");
  assert.equal(dns.reachable, false);

  const timeout = await fetchPageSafely("https://slow.example/", {
    resolveHost: publicResolver,
    fetchImpl: (async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as unknown as typeof fetch,
  });
  assert.equal(timeout.category, "TIMEOUT");

  const refused = await fetchPageSafely("https://refused.example/", {
    resolveHost: publicResolver,
    fetchImpl: (async () => {
      const error = new Error("connection refused") as Error & { code?: string };
      error.code = "ECONNREFUSED";
      throw error;
    }) as unknown as typeof fetch,
  });
  assert.equal(refused.category, "BLOCKED");
});
