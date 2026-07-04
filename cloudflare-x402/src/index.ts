/**
 * XCity Cloudflare x402 Monetization Gateway (L-016)
 *
 * Sub-task 2: x402 monetize middleware — any API/resource behind Cloudflare can
 * enable x402 payments with zero backend code changes.
 *
 * Sub-task 3: facilitator URL injection with default 70% x402 / 30% X401 routing.
 *
 * Deploy: wrangler deploy
 * Rollback: wrangler rollback (30-second versioned rollback — see ROLLBACK.md)
 */

export interface Env {
  // Per-project x402 enable flag (sub-task 1)
  X402_ENABLED: string; // "true" | "false"

  // Facilitator URL (sub-task 3)
  X402_FACILITATOR_URL: string; // e.g. "https://facilitator.coinbase.com"

  // X401 (legacy) fallback facilitator URL
  X401_FACILITATOR_URL: string; // e.g. "https://x401.xcity.one"

  // Routing ratio: percentage of traffic to route through x402 (0-100)
  X402_ROUTE_PERCENT: string; // default "70"

  // Receiver USDC address on Base
  X402_RECEIVER_ADDRESS: string;

  // Per-request price in USDC atomic units (6 decimals: 10000 = $0.01)
  X402_PRICE_USDC: string; // default "10000"

  // Chain identifier (CAIP-2 format)
  X402_NETWORK: string; // default "eip155:8453" (Base mainnet)

  // KV namespace for payment replay protection
  PAYMENT_CACHE: KVNamespace;

  // Target origin to proxy to
  UPSTREAM_ORIGIN: string;
}

interface PaymentRequiredResponse {
  x402Version: number;
  error: string;
  accepts: PaymentOption[];
}

interface PaymentOption {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
}

// USDC contract address on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Routing decision: returns true if this request should use x402
function shouldUseX402(env: Env): boolean {
  const percent = parseInt(env.X402_ROUTE_PERCENT || "70", 10);
  return Math.random() * 100 < percent;
}

// Build the 402 Payment Required response body (x402 protocol v2)
function buildPaymentRequired(request: Request, env: Env): PaymentRequiredResponse {
  const url = new URL(request.url);
  const resource = url.toString();
  const price = env.X402_PRICE_USDC || "10000";
  const network = env.X402_NETWORK || "eip155:8453";

  return {
    x402Version: 1,
    error: "X-PAYMENT-REQUIRED",
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: price,
        resource,
        description: "XCity AI API access via x402",
        mimeType: "application/json",
        payTo: env.X402_RECEIVER_ADDRESS,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
        extra: { name: "USDC", version: "1" },
      },
    ],
  };
}

// Verify payment by calling the facilitator /verify endpoint
async function verifyPayment(
  paymentPayload: string,
  resource: string,
  facilitatorUrl: string
): Promise<boolean> {
  try {
    const resp = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: paymentPayload, resource }),
    });
    if (!resp.ok) return false;
    const body = await resp.json<{ isValid: boolean }>();
    return body.isValid === true;
  } catch {
    return false;
  }
}

// Settle payment asynchronously (fire-and-forget with best-effort)
async function settlePayment(
  paymentPayload: string,
  resource: string,
  facilitatorUrl: string
): Promise<void> {
  try {
    await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: paymentPayload, resource }),
    });
  } catch {
    // settlement failure is non-fatal; the next request will trigger a new payment
  }
}

// Proxy request to upstream origin, preserving headers
async function proxyToUpstream(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  url.hostname = new URL(env.UPSTREAM_ORIGIN).hostname;
  url.protocol = new URL(env.UPSTREAM_ORIGIN).protocol;
  url.port = "";

  const upstreamRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow",
  });

  return fetch(upstreamRequest);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Sub-task 1: per-project opt-in flag
    if (env.X402_ENABLED !== "true") {
      return proxyToUpstream(request, env);
    }

    // Pass-through for non-API paths (health checks, etc.)
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/favicon.ico") {
      return proxyToUpstream(request, env);
    }

    const paymentHeader = request.headers.get("X-PAYMENT");

    // No payment header → return 402
    if (!paymentHeader) {
      const body = buildPaymentRequired(request, env);
      return new Response(JSON.stringify(body), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-402-Version": "1",
        },
      });
    }

    // Sub-task 3: facilitator URL injection with 70/30 routing
    const useX402 = shouldUseX402(env);
    const facilitatorUrl = useX402
      ? env.X402_FACILITATOR_URL
      : env.X401_FACILITATOR_URL;

    // Verify payment with selected facilitator
    const resource = url.toString();
    const isValid = await verifyPayment(paymentHeader, resource, facilitatorUrl);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Payment verification failed", x402Version: 1 }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Proxy request to upstream and settle asynchronously
    const upstreamResponse = await proxyToUpstream(request, env);

    // Settle asynchronously without blocking response (sub-task 6: no blocking)
    ctx.waitUntil(settlePayment(paymentHeader, resource, facilitatorUrl));

    // Forward upstream response with payment response header
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("X-PAYMENT-RESPONSE", JSON.stringify({ success: true }));
    responseHeaders.set("X-402-Facilitator", useX402 ? "x402" : "x401");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  },
};
