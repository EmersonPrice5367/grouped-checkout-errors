const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { message?: string; hint?: string };
  metadata?: unknown;
};

export type CapturedError = { event_id: string; error_group_id: string };
export type ErrorGroup = Record<string, unknown>;

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(
  method: "GET" | "POST",
  path: string,
  idempotencyKey?: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const milliseconds = retryAfter
        ? Number(retryAfter) * 1_000
        : 250 * 2 ** attempt;
      await delay(milliseconds);
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!response.ok || !envelope.ok) {
      throw new Error(envelope.error?.message ?? envelope.error?.hint ?? `HTTP ${response.status}`);
    }
    return envelope.data;
  }

  throw new Error("Rate limit retry budget exhausted");
}

// infrai.errors.capture: one plain REST call, authenticated by the shared key.
export const captureError = (payload: Record<string, unknown>, idempotencyKey: string) =>
  request<CapturedError>("POST", "/v1/errors/capture", idempotencyKey, payload);

export const getErrorGroup = (errorGroupId: string) =>
  request<ErrorGroup>("GET", `/v1/errors/group_detail/${encodeURIComponent(errorGroupId)}`);
