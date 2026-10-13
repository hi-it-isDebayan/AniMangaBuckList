import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_COOKIE } from "./auth";
import { logoutRedirect } from "./logout";

test("logout responds with 303 so the follow-up request is a GET", () => {
  const res = logoutRedirect();
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/login");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("logout returns a RELATIVE location (no internal origin leak)", () => {
  const res = logoutRedirect();
  const location = res.headers.get("location") ?? "";
  assert.equal(location, "/login");
  assert.ok(!/^https?:\/\//i.test(location), `location leaked an origin: ${location}`);
});

test("logout clears the session cookie with Max-Age=0", () => {
  const res = logoutRedirect();
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.ok(
    setCookie.startsWith(`${SESSION_COOKIE}=`),
    `expected ${SESSION_COOKIE} to be cleared, got: ${setCookie}`,
  );
  assert.match(setCookie, /max-age=0/i);
  assert.match(setCookie, /path=\//i);
  assert.match(setCookie, /httponly/i);
});
