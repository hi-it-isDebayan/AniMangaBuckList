import assert from "node:assert/strict";
import { test } from "node:test";
import { HEALTH_FAILURE_THRESHOLD, nextHealth, nextHealthStatus } from "./sources/health";
import type { HealthState } from "./sources/health";

const initial: HealthState = {
  status: "UNVERIFIED",
  consecutiveFailures: 0,
  lastFailureCategory: "NONE",
  lastCheckedAt: null,
  lastSuccessAt: null,
};

test("a single transient failure never marks a source BROKEN", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const afterOne = nextHealth(initial, { reachable: false, extractOk: false, category: "TIMEOUT" }, now);
  assert.equal(afterOne.status, "DEGRADED");
  assert.equal(afterOne.consecutiveFailures, 1);
  assert.equal(afterOne.lastFailureCategory, "TIMEOUT");
  assert.equal(afterOne.lastCheckedAt?.toISOString(), now.toISOString());
});

test("repeated failures cross to BROKEN at the threshold", () => {
  let state = initial;
  for (let i = 1; i < HEALTH_FAILURE_THRESHOLD; i += 1) {
    state = nextHealth(state, { reachable: false, extractOk: false, category: "HTTP_5XX" });
    assert.equal(state.status, "DEGRADED", `failure ${i} should still be DEGRADED`);
  }
  state = nextHealth(state, { reachable: false, extractOk: false, category: "HTTP_5XX" });
  assert.equal(state.status, "BROKEN");
  assert.equal(state.consecutiveFailures, HEALTH_FAILURE_THRESHOLD);
});

test("a success resets failures and records lastSuccessAt", () => {
  let state = nextHealth(initial, { reachable: false, extractOk: false, category: "DNS" });
  state = nextHealth(state, { reachable: false, extractOk: false, category: "DNS" });
  const now = new Date("2026-02-02T12:00:00Z");
  const recovered = nextHealth(state, { reachable: true, extractOk: true }, now);
  assert.equal(recovered.status, "WORKING");
  assert.equal(recovered.consecutiveFailures, 0);
  assert.equal(recovered.lastFailureCategory, "NONE");
  assert.equal(recovered.lastSuccessAt?.toISOString(), now.toISOString());
});

test("reachable but not extractable is a failure (compatibility separate)", () => {
  const state = nextHealth(initial, { reachable: true, extractOk: false, category: "PARSE_MISMATCH" });
  assert.equal(state.status, "DEGRADED");
  assert.equal(state.lastFailureCategory, "PARSE_MISMATCH");
});

test("failures preserve the previous lastSuccessAt", () => {
  const successAt = new Date("2026-03-03T00:00:00Z");
  const healthy: HealthState = { ...initial, status: "WORKING", lastSuccessAt: successAt };
  const failed = nextHealth(healthy, { reachable: false, extractOk: false, category: "TIMEOUT" });
  assert.equal(failed.status, "DEGRADED");
  assert.equal(failed.lastSuccessAt?.toISOString(), successAt.toISOString());
});

test("unknown failure category defaults to UNKNOWN, never raw text", () => {
  const state = nextHealth(initial, { reachable: false, extractOk: false });
  assert.equal(state.lastFailureCategory, "UNKNOWN");
});

test("nextHealthStatus is threshold-based", () => {
  assert.equal(nextHealthStatus(1, false), "DEGRADED");
  assert.equal(nextHealthStatus(2, false), "DEGRADED");
  assert.equal(nextHealthStatus(3, false), "BROKEN");
  assert.equal(nextHealthStatus(0, true), "WORKING");
});
