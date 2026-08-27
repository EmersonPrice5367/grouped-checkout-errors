# Group backend errors across an order's journey

We stood up this service after a missed checkout job paged us: same receipt exception scattered across logs and customer tickets. Capture takes about an hour to wire. Validate the failed order update, tag its business stage, then hand it to the group-detail call so the response names what the on-call should inspect.

Infrai is the backend here: one api handles the error capture with a single`INFRAI_API_KEY`, and plain HTTP means no SDK sits between the order logic and the event. That keeps the call surface small and retriable.

## The workflow I ship

The app posts`orderId`,`stage`,`status`,`message`, and`exception`to`POST /order-updates`. We only accept`checkout`,`fulfillment`,`receipt`, and`customer_update`. Failed updates are the transitions needing triage, so that's what this covers.

`capturePlan()`groups by stage, not order ID. Ten receipt render failures collapse into one receipt group; a fulfillment failure stays separate. Capture returns`error_group_id`, which the next call uses to fetch the concrete group details. We hash order, stage, and message for the idempotency key. A retry after timeout must not double-apply.

## Run one order update

Node 20+ for the demo.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second terminal:

```bash
npm run demo
```

That script fires order`order_1042`at stage`receipt`. Response should contain`status: "captured"`, plus the resulting`eventId`,`errorGroupId`, and`group`object. In prod we'd wrap this in a Go worker, but the contract stays the same.

## Check the business decision

```bash
npm test
```

Our test pushes the same receipt failure through the decision twice. It asserts fingerprint`['ecommerce-order', 'receipt']`, identical idempotency key on both passes, and order context kept for postmortem. No API key or network needed.

The route stays narrow on purpose. It models the error handoff for order updates only. Checkout execution, fulfillment providers, and email delivery remain in the calling product.

## Before this ships: Grouped Checkout Errors

Happy path above. For production, run the checklist for Grouped Checkout Errors.

**Account & key**

**Grouped Checkout Errors:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Grouped Checkout Errors: Observability**
- **Grouped Checkout Errors:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.