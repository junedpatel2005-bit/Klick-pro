import "server-only";
import crypto from "node:crypto";

// Read on every call rather than caching in a module-level const. A long-lived
// server process would otherwise keep serving whatever the values were at
// import time, and changing one of them would silently require a restart.
function config() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "",
    routeEnabled: process.env.RAZORPAY_ROUTE_ENABLED === "true",
  };
}

// Credentials are the source of truth for Razorpay availability. Keep the
// flag as an explicit opt-out so deployments that only define the credentials
// do not incorrectly return "funding is not configured".
const enabled = () => process.env.RAZORPAY_ENABLED !== "false";

export function razorpayConfig() {
  return { enabled: enabled(), keyId: config().keyId };
}

export function isRazorpayConfigured() {
  const current = config();
  return enabled() && Boolean(current.keyId && current.keySecret);
}

export function isRazorpayWebhookConfigured() {
  return enabled() && Boolean(config().webhookSecret);
}

export function isRazorpayRouteConfigured() {
  return isRazorpayConfigured() && config().routeEnabled;
}

export async function createRazorpayPaymentTransfer(input: {
  paymentId: string;
  accountId: string;
  amountRupees: number;
  referenceId: string;
}) {
  if (!isRazorpayRouteConfigured()) return null;
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/transfers`,
    {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        transfers: [
          {
            account: input.accountId,
            amount: Math.round(input.amountRupees * 100),
            currency: "INR",
            notes: { withdrawal_id: input.referenceId },
          },
        ],
      }),
      cache: "no-store",
    },
  );
  const body = (await response.json().catch(() => null)) as {
    items?: Array<{ id?: string }>;
    error?: { description?: string };
  } | null;
  if (!response.ok || !body?.items?.[0]?.id)
    throw new Error(body?.error?.description ?? `Razorpay transfer failed (${response.status}).`);
  return body.items[0].id;
}

function authHeader() {
  const { keyId, keySecret } = config();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export type LinkedAccountCheck =
  | { ok: true; accountId: string }
  | { ok: false; reason: "not_configured" | "not_found" | "inactive" | "error" };

/**
 * Confirms a linked account really exists under this merchant's Razorpay key
 * and is usable for payouts.
 *
 * A professional-supplied `acc_*` string is otherwise unverified, so an admin
 * payout could be routed to an account the professional does not control. The
 * fetch only succeeds for accounts created under our own API key, which is
 * what makes this an ownership check rather than a format check.
 */
export async function verifyRazorpayLinkedAccount(accountId: string): Promise<LinkedAccountCheck> {
  if (!isRazorpayConfigured()) return { ok: false, reason: "not_configured" };

  const response = await fetch(
    `https://api.razorpay.com/v1/accounts/${encodeURIComponent(accountId)}`,
    { headers: { Authorization: authHeader() }, cache: "no-store" },
  );

  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (!response.ok) return { ok: false, reason: "error" };

  const body = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
  } | null;

  if (!body?.id) return { ok: false, reason: "not_found" };
  // A linked account that is not activated yet cannot receive a transfer.
  if (body.status && body.status !== "activated") {
    return { ok: false, reason: "inactive" };
  }
  return { ok: true, accountId: body.id };
}

export async function createRazorpayOrder(input: {
  amountRupees: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  if (!isRazorpayConfigured()) return null;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(input.amountRupees * 100),
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    error?: { description?: string };
  } | null;
  if (!response.ok || !body?.id)
    throw new Error(
      body?.error?.description ?? `Razorpay order creation failed (${response.status}).`,
    );
  return {
    orderId: body.id,
    amount: body.amount ?? Math.round(input.amountRupees * 100),
    currency: body.currency ?? "INR",
    status: body.status ?? "created",
  };
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = crypto
    .createHmac("sha256", config().keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  if (!isRazorpayWebhookConfigured() || !signature) return false;
  const expected = crypto
    .createHmac("sha256", config().webhookSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type RazorpayCapturedPayment = {
  id: string;
  orderId: string;
  amount: number; // in paise
  currency: string;
  status: string; // "captured", "authorized", "failed", etc.
};

/**
 * Reconciles with Razorpay API directly to fetch all payments associated with an order.
 * Essential for resolving missing frontend callbacks, delayed webhooks, UPI app switches,
 * or browser closures immediately when the user returns.
 */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayCapturedPayment[]> {
  if (!isRazorpayConfigured()) return [];
  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`,
      {
        headers: { Authorization: authHeader() },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as {
      items?: Array<{
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      }>;
    } | null;
    if (!body?.items || !Array.isArray(body.items)) return [];
    return body.items
      .filter((p) => Boolean(p.id && p.status))
      .map((p) => ({
        id: p.id!,
        orderId: p.order_id ?? orderId,
        amount: p.amount ?? 0,
        currency: p.currency ?? "INR",
        status: p.status!,
      }));
  } catch (error) {
    console.error("fetchRazorpayOrderPayments error:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

