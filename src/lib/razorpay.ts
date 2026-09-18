import "server-only";
import crypto from "node:crypto";

const config = {
  keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
  keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "",
  routeEnabled: process.env.RAZORPAY_ROUTE_ENABLED === "true",
};

// Credentials are the source of truth for Razorpay availability. Keep the
// flag as an explicit opt-out so deployments that only define the credentials
// do not incorrectly return "funding is not configured".
const enabled = process.env.RAZORPAY_ENABLED !== "false";

export function razorpayConfig() {
  return { enabled, keyId: config.keyId };
}

export function isRazorpayConfigured() {
  return enabled && Boolean(config.keyId && config.keySecret);
}

export function isRazorpayWebhookConfigured() {
  return enabled && Boolean(config.webhookSecret);
}

export function isRazorpayRouteConfigured() {
  return isRazorpayConfigured() && config.routeEnabled;
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
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
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
    .createHmac("sha256", config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  if (!isRazorpayWebhookConfigured() || !signature) return false;
  const expected = crypto.createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
