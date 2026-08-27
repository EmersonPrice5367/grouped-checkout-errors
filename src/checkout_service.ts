import { createServer } from "node:http";
import { z } from "zod";
import { captureAndInspect } from "./checkout_errors.js";
import type { OrderFailure } from "./checkout_errors.js";

const orderUpdate = z.object({
  orderId: z.string().min(1),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_update"]),
  status: z.enum(["failed"]),
  message: z.string().min(1),
  exception: z.string().min(1),
});

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-updates") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const update = orderUpdate.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    ) as OrderFailure;
    const result = await captureAndInspect(update);
    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "captured", ...result }));
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 502;
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Order update service listening on http://localhost:${port}`));
