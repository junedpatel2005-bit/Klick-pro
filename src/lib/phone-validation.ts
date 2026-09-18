export type PhoneValidationRule = {
  minDigits: number;
  maxDigits: number;
};

// Registration uses a consistent 10-digit national phone-number format for
// every country option shown in the form.
const defaultPhoneRule: PhoneValidationRule = { minDigits: 10, maxDigits: 10 };

export function getPhoneValidationRule(countryCode: string): PhoneValidationRule {
  void countryCode;
  return defaultPhoneRule;
}

export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhoneNumber(phone: string, countryCode: string): boolean {
  const digits = getPhoneDigits(phone);
  const rule = getPhoneValidationRule(countryCode);
  return digits.length >= rule.minDigits && digits.length <= rule.maxDigits;
}

export function phoneValidationMessage(countryCode: string): string {
  const rule = getPhoneValidationRule(countryCode);
  if (rule.minDigits === rule.maxDigits) {
    return `Enter a ${rule.minDigits}-digit phone number.`;
  }
  return `Enter a phone number with ${rule.minDigits}-${rule.maxDigits} digits.`;
}

export function isValidInternationalPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!/^\+\d+$/.test(trimmed)) return false;

  // The API receives the country code together with the national number.
  // Validate the national portion against the same 10-digit rule as the form.
  const countryCode = [
    "+971",
    "+880",
    "+234",
    "+91",
    "+65",
    "+61",
    "+49",
    "+44",
    "+33",
    "+27",
    "+92",
    "+94",
    "+81",
    "+86",
    "+1",
  ]
    .sort((a, b) => b.length - a.length)
    .find((code) => trimmed.startsWith(code));
  if (!countryCode) return false;
  return trimmed.slice(countryCode.length).length === 10;
}
