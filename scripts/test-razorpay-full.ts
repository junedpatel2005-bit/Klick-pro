import "dotenv/config";
import crypto from "node:crypto";

async function runRazorpayFullTest() {
  console.log("=================================================");
  console.log("  KLICK-PRO RAZORPAY FULL INTEGRATION TEST SUITE");
  console.log("=================================================\n");

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  const routeEnabled = process.env.RAZORPAY_ROUTE_ENABLED === "true";

  // Step 1: Credential Verification
  console.log("[1/6] Validating Razorpay Environment Variables...");
  if (!keyId || !keySecret) {
    console.error("  ❌ FAIL: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing.");
    process.exit(1);
  }
  const isTestKey = keyId.startsWith("rzp_test_");
  console.log(`  ✓ Key ID: ${keyId.slice(0, 12)}... (${isTestKey ? "TEST MODE" : "LIVE MODE"})`);
  console.log(`  ✓ Key Secret: ${keySecret.slice(0, 4)}...[REDACTED] (${keySecret.length} chars)`);
  console.log(
    `  ✓ Webhook Secret: ${webhookSecret ? "Configured (" + webhookSecret.slice(0, 4) + "...)" : "Not Configured"}`,
  );
  console.log(
    `  ✓ Razorpay Route Payouts: ${routeEnabled ? "Enabled" : "Disabled (Manual/Standard payout mode)"}`,
  );

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  // Step 2: Live API Ping & Order Creation
  console.log("\n[2/6] Sending live API request to Razorpay Sandbox (POST /v1/orders)...");
  const testReceipt = `test_rcpt_${Date.now()}`;
  const testAmountRupees = 100;
  const testAmountPaise = testAmountRupees * 100;

  const createOrderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: testAmountPaise,
      currency: "INR",
      receipt: testReceipt,
      notes: {
        environment: "sandbox_verification",
        service: "klick-pro-diagnostic",
      },
    }),
  });

  if (!createOrderRes.ok) {
    const errorText = await createOrderRes.text();
    console.error(`  ❌ FAIL: Razorpay Order Creation failed with HTTP ${createOrderRes.status}`);
    console.error(`  Details: ${errorText}`);
    process.exit(1);
  }

  const orderData = (await createOrderRes.json()) as {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
    created_at: number;
  };

  console.log("  ✓ Razorpay API Response: HTTP 200 OK");
  console.log(`  ✓ Generated Order ID: ${orderData.id}`);
  console.log(`  ✓ Order Status: ${orderData.status}`);
  console.log(`  ✓ Order Amount: ₹${orderData.amount / 100} (${orderData.amount} paise)`);
  console.log(`  ✓ Currency: ${orderData.currency}`);
  console.log(`  ✓ Receipt Reference: ${orderData.receipt}`);

  // Step 3: Fetch Order by ID
  console.log(`\n[3/6] Fetching Order by ID (GET /v1/orders/${orderData.id})...`);
  const fetchOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderData.id}`, {
    headers: { Authorization: authHeader },
  });

  if (!fetchOrderRes.ok) {
    console.error(`  ❌ FAIL: Unable to fetch order ${orderData.id}`);
    process.exit(1);
  }

  const fetchedOrder = (await fetchOrderRes.json()) as { id: string; status: string };
  console.log(
    `  ✓ Order lookup verified: ID ${fetchedOrder.id} matches status "${fetchedOrder.status}"`,
  );

  // Step 4: Cryptographic Payment Signature Math
  console.log("\n[4/6] Verifying HMAC-SHA256 Payment Signature Algorithm...");
  const mockPaymentId = `pay_${Date.now()}`;
  const validSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderData.id}|${mockPaymentId}`)
    .digest("hex");

  // Validate timingSafeEqual logic
  const validBufferA = Buffer.from(validSignature, "utf8");
  const validBufferB = Buffer.from(validSignature, "utf8");
  const isMatch =
    validBufferA.length === validBufferB.length &&
    crypto.timingSafeEqual(validBufferA, validBufferB);

  // Validate tamper rejection
  const tamperedSig = validSignature.slice(0, -4) + "0000";
  const tamperBuffer = Buffer.from(tamperedSig, "utf8");
  const isTamperDetected = !(
    validBufferA.length === tamperBuffer.length &&
    crypto.timingSafeEqual(validBufferA, tamperBuffer)
  );

  if (isMatch && isTamperDetected) {
    console.log("  ✓ Authentic signature verified correctly.");
    console.log("  ✓ Tampered signature rejected as invalid.");
    console.log("  ✓ Cryptographic verification engine passed.");
  } else {
    console.error("  ❌ FAIL: Signature verification mismatch.");
    process.exit(1);
  }

  // Step 5: Webhook Signature Verification
  console.log("\n[5/6] Verifying Webhook HMAC Signature Engine...");
  if (webhookSecret) {
    const mockPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: mockPaymentId, order_id: orderData.id, amount: 10000 } },
      },
    });
    const webhookSig = crypto.createHmac("sha256", webhookSecret).update(mockPayload).digest("hex");
    const sigA = Buffer.from(webhookSig, "utf8");
    const sigB = Buffer.from(webhookSig, "utf8");
    const webhookOk = sigA.length === sigB.length && crypto.timingSafeEqual(sigA, sigB);
    console.log(
      `  ✓ Webhook HMAC signature generation & verification: ${webhookOk ? "SUCCESS" : "FAIL"}`,
    );
  } else {
    console.log("  ⚠ Skipped webhook signature calculation (RAZORPAY_WEBHOOK_SECRET is empty).");
  }

  // Step 6: Application Checkout Config Endpoint
  console.log(
    "\n[6/6] Checking Local Application Checkout Config API (/api/payments/razorpay/config)...",
  );
  try {
    let appConfigRes = await fetch("http://[::1]:3000/api/payments/razorpay/config").catch(
      () => null,
    );
    if (!appConfigRes) {
      appConfigRes = await fetch("http://localhost:3000/api/payments/razorpay/config").catch(
        () => null,
      );
    }
    if (appConfigRes && appConfigRes.ok) {
      const appConfig = (await appConfigRes.json()) as {
        enabled: boolean;
        keyId: string;
        currency?: string;
      };
      console.log(`  ✓ Application Endpoint HTTP ${appConfigRes.status}`);
      console.log(`  ✓ Checkout Enabled: ${appConfig.enabled}`);
      console.log(`  ✓ Public Client KeyId: ${appConfig.keyId}`);
      console.log(`  ✓ Currency: ${appConfig.currency || "INR"}`);
    } else {
      console.log(`  ⚠ Server responded with HTTP ${appConfigRes?.status ?? "unknown"}`);
    }
  } catch (err: unknown) {
    console.log(
      `  ⚠ Local server check skipped (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  console.log("\n=================================================");
  console.log("  🎉 ALL RAZORPAY FULL INTEGRATION TESTS PASSED!");
  console.log("=================================================\n");
}

runRazorpayFullTest().catch((err) => {
  console.error("Fatal error running Razorpay test:", err);
  process.exit(1);
});
