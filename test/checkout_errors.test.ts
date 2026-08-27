import assert from "node:assert/strict";
import test from "node:test";
import { capturePlan } from "../src/checkout_errors.js";

test("repeated receipt failures group together without duplicate writes", () => {
  const failure = {
    orderId: "order_1042",
    stage: "receipt" as const,
    message: "Receipt email rendering failed",
    exception: "Error: missing receipt line item template",
  };

  const first = capturePlan(failure);
  const retry = capturePlan(failure);

  assert.deepEqual(first.payload.fingerprint, ["ecommerce-order", "receipt"]);
  assert.equal(first.idempotencyKey, retry.idempotencyKey);
  assert.deepEqual(first.payload.context, { order_id: "order_1042", stage: "receipt" });
});
