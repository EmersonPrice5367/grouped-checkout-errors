import { createHash } from "node:crypto";
import { captureError, getErrorGroup } from "./infrai_errors.js";

export type OrderStage = "checkout" | "fulfillment" | "receipt" | "customer_update";

export type OrderFailure = {
  orderId: string;
  stage: OrderStage;
  message: string;
  exception: string;
};

export function capturePlan(failure: OrderFailure) {
  const fingerprint = ["ecommerce-order", failure.stage];
  const idempotencyKey = createHash("sha256")
    .update(`${failure.orderId}:${failure.stage}:${failure.message}`)
    .digest("hex");

  return {
    idempotencyKey,
    payload: {
      title: `${failure.stage} failed`,
      message: failure.message,
      level: "error",
      fingerprint,
      exception: failure.exception,
      context: { order_id: failure.orderId, stage: failure.stage },
    },
  };
}

export async function captureAndInspect(failure: OrderFailure) {
  const plan = capturePlan(failure);
  const captured = await captureError(plan.payload, plan.idempotencyKey);
  const group = await getErrorGroup(captured.error_group_id);
  return { eventId: captured.event_id, errorGroupId: captured.error_group_id, group };
}
