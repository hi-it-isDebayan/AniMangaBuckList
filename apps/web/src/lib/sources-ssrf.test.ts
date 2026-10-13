import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertResolvedAddressesPublic,
  assertSafeUrlShape,
  isBlockedAddress,
  isBlockedHostname,
  isBlockedIpv4,
  isBlockedIpv6,
} from "./sources/ssrf";

test("private / loopback / link-local IPv4 are blocked", () => {
  for (const ip of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
  ]) {
    assert.equal(isBlockedIpv4(ip), true, `${ip} should be blocked`);
  }
});

test("public IPv4 addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "93.184.216.34"]) {
    assert.equal(isBlockedIpv4(ip), false, `${ip} should be allowed`);
  }
});

test("loopback / ULA / link-local IPv6 are blocked, global IPv6 is not", () => {
  assert.equal(isBlockedIpv6("::1"), true);
  assert.equal(isBlockedIpv6("::"), true);
  assert.equal(isBlockedIpv6("fe80::1"), true);
  assert.equal(isBlockedIpv6("fd00::1"), true);
  assert.equal(isBlockedIpv6("fc00::1"), true);
  assert.equal(isBlockedIpv6("ff02::1"), true);
  assert.equal(isBlockedIpv6("2001:4860:4860::8888"), false);
});

test("IPv4-mapped IPv6 defers to the IPv4 rules", () => {
  assert.equal(isBlockedAddress("::ffff:127.0.0.1"), true);
  assert.equal(isBlockedAddress("::ffff:8.8.8.8"), false);
});

test("internal hostnames are blocked", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("LOCALHOST."), true);
  assert.equal(isBlockedHostname("foo.local"), true);
  assert.equal(isBlockedHostname("db.internal"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});

test("assertSafeUrlShape rejects internal targets and unsafe schemes", () => {
  assert.equal(assertSafeUrlShape("http://localhost/").ok, false);
  assert.equal(assertSafeUrlShape("http://127.0.0.1:6379/").ok, false);
  assert.equal(assertSafeUrlShape("http://169.254.169.254/latest/meta-data/").ok, false);
  assert.equal(assertSafeUrlShape("http://10.0.0.5/").ok, false);
  assert.equal(assertSafeUrlShape("file:///etc/passwd").ok, false);
  assert.equal(assertSafeUrlShape("ftp://example.com").ok, false);
  assert.equal(assertSafeUrlShape("http://user:pass@example.com").ok, false);
  assert.equal(assertSafeUrlShape("gopher://example.com").ok, false);
});

test("assertSafeUrlShape allows ordinary public websites", () => {
  const result = assertSafeUrlShape("https://example.com/read/chapter-1");
  assert.equal(result.ok, true);
});

test("assertResolvedAddressesPublic requires every address to be public", () => {
  assert.equal(assertResolvedAddressesPublic(["93.184.216.34"]).ok, true);
  assert.equal(assertResolvedAddressesPublic(["93.184.216.34", "127.0.0.1"]).ok, false);
  assert.equal(assertResolvedAddressesPublic(["169.254.169.254"]).ok, false);
  assert.equal(assertResolvedAddressesPublic([]).ok, false);
});
