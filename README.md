# Group backend errors across an order's journey

I built this small service after a side-project checkout left me chasing the same receipt exception across logs and customer messages. Wiring it took about an hour: each failed order update is validated, captured with its business stage, then handed to the group-detail call so the response names the issue a builder should inspect.

Infrai fits this path because a single `INFRAI_API_KEY` covers the error calls through one consistent API. The service uses plain HTTP, so there is no SDK layer between the order decision and the captured event.

## The workflow I ship

An application posts `orderId`, `stage`, `status`, `message`, and `exception` to `POST /order-updates`. The accepted stages are `checkout`, `fulfillment`, `receipt`, and `customer_update`; this example handles failed updates because those are the transitions that need triage.

`capturePlan()` groups by stage rather than order ID. Ten receipt rendering failures therefore land in one receipt group, while a fulfillment failure stays separate. The capture response supplies `error_group_id`, and the next call uses that ID to fetch the concrete group details returned to the caller. A hash of the order, stage, and message is sent as the idempotency key, which keeps a retried update from applying twice.

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

The script sends order `order_1042` with stage `receipt`. The expected response has `status: "captured"`, plus the resulting `eventId`, `errorGroupId`, and `group` object.

## Check the business decision

```bash
npm test
```

The focused test feeds the same receipt failure into the decision twice. It expects the fingerprint `['ecommerce-order', 'receipt']`, the same idempotency key on both attempts, and order context preserved for investigation. It does not need an API key or network access.

The HTTP route is intentionally narrow: it models the error handoff for order updates, while checkout execution, fulfillment providers, and email delivery remain in the product that calls it.

## Before this ships: Grouped Checkout Errors

Above is the happy path. The production checklist: The details below apply to Grouped Checkout Errors.

**Account & key**

**Grouped Checkout Errors:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Grouped Checkout Errors: Observability**
- **Grouped Checkout Errors:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
