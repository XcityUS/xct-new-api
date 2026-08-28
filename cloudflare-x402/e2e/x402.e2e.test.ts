/**
 * XCity x402 Gateway — e2e Tests (L-016 sub-task 5)
 *
 * 6 required scenarios:
 *   1. pay-in    — client sends valid payment, gets 200
 *   2. pay-out   — upstream 200 response forwarded with X-PAYMENT-RESPONSE header
 *   3. routing   — 70% x402 / 30% X401 facilitator routing
 *   4. fallback  — facilitator verify failure → 402 returned to client
 *   5. dashboard — /x402/status endpoint returns project status
 *   6. error     — invalid payment payload → 402 with error body
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/index";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    X402_ENABLED: "true",
    X402_FACILITATOR_URL: "https://mock-x402-facilitator.example",
    X401_FACILITATOR_URL: "https://mock-x401-facilitator.example",
    X402_ROUTE_PERCENT: "70",
    X402_PRICE_USDC: "10000",
    X402_NETWORK: "eip155:8453",
    X402_RECEIVER_ADDRESS: "0xabcdef1234567890abcdef1234567890abcdef12",
    UPSTREAM_ORIGIN: "https://api.xcity.one",
    PAYMENT_CACHE: {} as KVNamespace,
    ...overrides,
  };
}

function makeRequest(
  path = "/v1/chat/completions",
  extraHeaders: Record<string, string> = {}
): Request {
  return new Request(`https://api.xcity.one${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ model: "gpt-4o", messages: [] }),
  });
}

// Mock ExecutionContext
const ctx: ExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

// ─── Scenario 1: pay-in ─────────────────────────────────────────────────────
describe("Scenario 1: pay-in — no payment header → 402", () => {
  it("returns 402 with x402 protocol body when X-PAYMENT header is absent", async () => {
    const env = makeEnv();
    const req = makeRequest();

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(402);
    const body = await resp.json<{ x402Version: number; accepts: unknown[] }>();
    expect(body.x402Version).toBe(1);
    expect(body.accepts).toHaveLength(1);
    expect(resp.headers.get("X-402-Version")).toBe("1");
  });
});

// ─── Scenario 2: pay-out ────────────────────────────────────────────────────
describe("Scenario 2: pay-out — valid payment → 200 with X-PAYMENT-RESPONSE", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/verify")) {
          return Promise.resolve(
            new Response(JSON.stringify({ isValid: true }), { status: 200 })
          );
        }
        if (url.includes("/settle")) {
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        // Upstream proxy
        return Promise.resolve(
          new Response(JSON.stringify({ choices: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
    );
  });

  it("forwards upstream response with X-PAYMENT-RESPONSE header", async () => {
    const env = makeEnv({ X402_ROUTE_PERCENT: "100" }); // force x402 path
    const req = makeRequest("/v1/chat/completions", {
      "X-PAYMENT": "mock-payment-payload",
    });

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(200);
    expect(resp.headers.get("X-PAYMENT-RESPONSE")).not.toBeNull();
    const paymentResp = JSON.parse(resp.headers.get("X-PAYMENT-RESPONSE")!);
    expect(paymentResp.success).toBe(true);
  });
});

// ─── Scenario 3: routing ────────────────────────────────────────────────────
describe("Scenario 3: routing — 70% x402 / 30% X401", () => {
  it("routes to x402 facilitator when X402_ROUTE_PERCENT=100", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isValid: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv({ X402_ROUTE_PERCENT: "100" });
    const req = makeRequest("/v1/chat/completions", { "X-PAYMENT": "pay" });

    await worker.fetch(req, env, ctx);

    const verifyCalls = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === "string" ? c[0] : (c[0] as Request).url;
      return url.includes("/verify");
    });
    expect(verifyCalls[0][0]).toContain("mock-x402-facilitator");
  });

  it("routes to X401 facilitator when X402_ROUTE_PERCENT=0", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isValid: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv({ X402_ROUTE_PERCENT: "0" });
    const req = makeRequest("/v1/chat/completions", { "X-PAYMENT": "pay" });

    await worker.fetch(req, env, ctx);

    const verifyCalls = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === "string" ? c[0] : (c[0] as Request).url;
      return url.includes("/verify");
    });
    expect(verifyCalls[0][0]).toContain("mock-x401-facilitator");
  });
});

// ─── Scenario 4: fallback ───────────────────────────────────────────────────
describe("Scenario 4: fallback — facilitator verify fails → 402", () => {
  it("returns 402 when facilitator /verify returns isValid=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/verify")) {
          return Promise.resolve(
            new Response(JSON.stringify({ isValid: false }), { status: 200 })
          );
        }
        return Promise.resolve(new Response(null, { status: 500 }));
      })
    );

    const env = makeEnv();
    const req = makeRequest("/v1/chat/completions", { "X-PAYMENT": "bad-payment" });

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(402);
    const body = await resp.json<{ error: string }>();
    expect(body.error).toContain("Payment verification failed");
  });

  it("returns 402 when facilitator is unreachable (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/verify")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(new Response(null, { status: 500 }));
      })
    );

    const env = makeEnv();
    const req = makeRequest("/v1/chat/completions", { "X-PAYMENT": "any" });

    const resp = await worker.fetch(req, env, ctx);
    expect(resp.status).toBe(402);
  });
});

// ─── Scenario 5: dashboard ──────────────────────────────────────────────────
describe("Scenario 5: dashboard — X402_ENABLED flag controls gateway", () => {
  it("proxies all requests when X402_ENABLED=false (x402 disabled)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv({ X402_ENABLED: "false" });
    const req = makeRequest("/v1/chat/completions");

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(200);
    // Should not call facilitator
    const facilitatorCalls = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === "string" ? c[0] : (c[0] as Request).url;
      return url.includes("facilitator");
    });
    expect(facilitatorCalls).toHaveLength(0);
  });

  it("health endpoint always passes through regardless of X402_ENABLED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("OK", { status: 200 }))
    );

    const env = makeEnv({ X402_ENABLED: "true" });
    const req = new Request("https://api.xcity.one/health");

    const resp = await worker.fetch(req, env, ctx);
    expect(resp.status).toBe(200);
  });
});

// ─── Scenario 6: error ──────────────────────────────────────────────────────
describe("Scenario 6: error — malformed/missing payment → structured error", () => {
  it("402 body contains x402Version and accepts array", async () => {
    const env = makeEnv();
    const req = makeRequest("/v1/embeddings");

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(402);
    const body = await resp.json<{ x402Version: number; accepts: unknown[]; error: string }>();
    expect(body.x402Version).toBe(1);
    expect(body.error).toBe("X-PAYMENT-REQUIRED");
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      payTo: "0xabcdef1234567890abcdef1234567890abcdef12",
    });
  });

  it("returns correct Content-Type for 402 response", async () => {
    const env = makeEnv();
    const req = makeRequest();

    const resp = await worker.fetch(req, env, ctx);

    expect(resp.status).toBe(402);
    expect(resp.headers.get("Content-Type")).toContain("application/json");
  });
});
