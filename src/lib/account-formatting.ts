/**
 * Client-safe account formatting and masking utilities.
 * Pure string manipulations with no Node.js dependencies.
 */

/**
 * Formats a bank account number or last4 into masked presentation:
 * e.g. "•••• •••• •••• 1234"
 */
export function maskAccountNumber(accountNumberOrLast4: string | null | undefined): string {
  if (!accountNumberOrLast4) return "—";
  const clean = String(accountNumberOrLast4).replace(/\s+/g, "").trim();
  if (clean.startsWith("enc:v1:")) {
    // If encrypted string is passed by mistake, mask using clean last 4 or generic mask
    return "•••• •••• •••• ••••";
  }
  const last4 = clean.length > 4 ? clean.slice(-4) : clean;
  return `•••• •••• •••• ${last4}`;
}

/**
 * Formats an account number input into spaced 4-digit groups for readability:
 * e.g. "123456789012" -> "1234 5678 9012"
 */
export function formatAccountNumberInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/**
 * Safely masks any raw destination label string (e.g. "918273645100" -> "•••• •••• •••• 5100")
 */
export function maskDestinationString(label: string | null | undefined, type?: string): string {
  if (!label) return type ? type.replace(/_/g, " ") : "Direct Transfer";
  const cleaned = label.trim();
  if (cleaned.startsWith("enc:v1:")) return "•••• •••• •••• ••••";
  if (/^\d{6,}$/.test(cleaned)) {
    return `•••• •••• •••• ${cleaned.slice(-4)}`;
  }
  return cleaned.replace(/\b\d{6,}\b/g, (match) => `•••• ${match.slice(-4)}`);
}
