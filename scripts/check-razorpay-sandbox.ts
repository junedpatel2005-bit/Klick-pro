import "dotenv/config";

const required = [
  ["RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID],
  ["RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET],
  ["RAZORPAY_WEBHOOK_SECRET", process.env.RAZORPAY_WEBHOOK_SECRET],
] as const;

const missing = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
const enabled = process.env.RAZORPAY_ENABLED !== "false";
const routeEnabled = process.env.RAZORPAY_ROUTE_ENABLED === "true";
const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";

console.log("Razorpay sandbox configuration");
console.log(`  enabled: ${enabled}`);
console.log(
  `  key mode: ${keyId.startsWith("rzp_test_") ? "TEST" : keyId ? "NON-TEST" : "MISSING"}`,
);
console.log(`  Route payouts: ${routeEnabled ? "enabled" : "disabled"}`);

if (missing.length > 0) {
  console.error(`Missing required variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!keyId.startsWith("rzp_test_")) {
  console.error("RAZORPAY_KEY_ID must be a Test Mode key beginning with rzp_test_.");
  process.exit(1);
}

if (!enabled) {
  console.error("RAZORPAY_ENABLED is false.");
  process.exit(1);
}

console.log("Configuration is ready for Razorpay Test Mode.");
