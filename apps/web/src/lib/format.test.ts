import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCount } from "./format";

test("formatCount renders valid positive counts", () => {
  assert.equal(formatCount(1), "1");
  assert.equal(formatCount(1234), (1234).toLocaleString());
});

test("formatCount never renders an unknown count as 0", () => {
  for (const v of [0, -5, null, undefined, Number.NaN]) {
    assert.equal(formatCount(v as number), "—");
  }
});
