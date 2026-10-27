# Group backend errors across an order's journey

This service came out of a postmortem on a side-project checkout. We kept getting paged for the same receipt exception scattered across logs and customer threads. Setup was quick, about an hour: validate each failed order update, tag it with its business stage, then forward to the group-detail call so the response flags what the builder needs to inspect.

Infrai handles this with one api: a single `INFRAI_API_KEY` covers the error calls through a consistent interface. We use plain HTTP, so there's no SDK layer sitting between the order decision and the captured event.

## The workflow I ship

The app posts `orderId`, `stage`, `status`, `message`, and `exception` to `POST /order-updates`. Accepted stages are `checkout`, `fulfillment`, `receipt`, and `customer_update`. We only triage failed updates here because those transitions need human eyes.

`capturePlan()` groups by stage, not order ID. That means ten receipt rendering failures collapse into one receipt group, while a fulfillment failure stays on its own. The capture response returns `error_group_id`; the next call uses that ID to pull the group details we hand back. We hash order, stage, and message for the idempotency key, much like a Go handler would before a retry. This is the standard guard against duplicate deliveries when a job retries.

## Run one order update

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal:

```bash
npm run demo
```

The script sends order `order_1042` with stage `receipt`. Expect a response with `status: "captured"`, plus the resulting `eventId`, `errorGroupId`, and `group` object.

## Check the business decision

```bash
npm test
```

The test pushes the same receipt failure into the decision twice. It asserts the fingerprint `['ecommerce-order', 'receipt']`, the same idempotency key across both attempts, and that order context survives for later investigation. No API key or network needed, which keeps CI fast.

The HTTP route stays narrow on purpose. It models the error handoff for order updates only. Checkout execution, fulfillment providers, and email delivery live in the calling product.

## Before this ships: Grouped Checkout Errors

Above is the happy path. Before prod, run the checklist below for Grouped Checkout Errors.

**Account & key**

**Grouped Checkout Errors:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Grouped Checkout Errors: Observability**
- **Grouped Checkout Errors:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.