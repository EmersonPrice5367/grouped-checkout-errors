const response = await fetch("http://localhost:3000/order-updates", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: "order_1042",
    stage: "receipt",
    status: "failed",
    message: "Receipt email rendering failed",
    exception: "Error: missing receipt line item template",
  }),
});

console.log(await response.json());

export {};
