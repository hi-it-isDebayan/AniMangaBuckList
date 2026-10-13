/**
 * Health state machine for community sources.
 *
 * A single transient failure must never mark a source BROKEN. It takes
 * `HEALTH_FAILURE_THRESHOLD` consecutive failures; a single failure only moves
 * a source to DEGRADED, and any success resets it to WORKING.
 */

export type HealthStatus = "WORKING" | "DEGRADED" | "BROKEN" | "UNVERIFIED";

export interface HealthState {
  status: HealthStatus;
  consecutiveFailures: number;
  /** Sanitized failure category (never raw upstream text). */
  lastFailureCategory: string;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
}

export interface HealthCheck {
  reachable: boolean;
  extractOk: boolean;
  /** Sanitized category, e.g. "TIMEOUT" / "HTTP_4XX". */
  category?: string;
}

export const HEALTH_FAILURE_THRESHOLD = 3;

export const INITIAL_HEALTH: HealthState = {
  status: "UNVERIFIED",
  consecutiveFailures: 0,
  lastFailureCategory: "NONE",
  lastCheckedAt: null,
  lastSuccessAt: null,
};

export function nextHealthStatus(
  consecutiveFailures: number,
  healthy: boolean,
): HealthStatus {
  if (healthy) return "WORKING";
  return consecutiveFailures >= HEALTH_FAILURE_THRESHOLD ? "BROKEN" : "DEGRADED";
}

export function nextHealth(
  prev: HealthState,
  check: HealthCheck,
  now: Date = new Date(),
): HealthState {
  const healthy = check.reachable && check.extractOk;

  if (healthy) {
    return {
      status: "WORKING",
      consecutiveFailures: 0,
      lastFailureCategory: "NONE",
      lastCheckedAt: now,
      lastSuccessAt: now,
    };
  }

  const consecutiveFailures = prev.consecutiveFailures + 1;
  return {
    status: nextHealthStatus(consecutiveFailures, false),
    consecutiveFailures,
    lastFailureCategory: check.category ?? "UNKNOWN",
    lastCheckedAt: now,
    lastSuccessAt: prev.lastSuccessAt,
  };
}
