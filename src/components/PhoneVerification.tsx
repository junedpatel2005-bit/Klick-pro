"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryCodes } from "@/lib/country-codes";
import { isValidPhoneNumber, phoneValidationMessage } from "@/lib/phone-validation";

export function PhoneVerification({
  role,
  initialPhone,
  onVerified,
}: {
  role: "CLIENT" | "PROFESSIONAL";
  initialPhone?: string | null;
  onVerified?: () => void;
}) {
  const initialCountry = countryCodes.find((country) => initialPhone?.startsWith(country.code));
  const [countryCode, setCountryCode] = useState(initialCountry?.code ?? "+91");
  const [phone, setPhone] = useState(
    initialPhone && initialCountry
      ? initialPhone.slice(initialCountry.code.length)
      : (initialPhone ?? ""),
  );
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

  async function sendCode() {
    setMessage(null);
    if (!isValidPhoneNumber(phone, countryCode)) {
      setMessage(phoneValidationMessage(countryCode));
      return;
    }
    setPending(true);
    const response = await fetch("/api/v1/auth/send-phone-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: fullPhone, role }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Unable to send the verification code.");
    setSent(true);
    inputRef.current?.focus();
  }

  async function verify() {
    setMessage(null);
    if (code.length !== 4) return setMessage("Enter the 4-digit verification code.");
    setPending(true);
    const response = await fetch("/api/v1/auth/verify-phone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: fullPhone, code, role }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Unable to verify this phone number.");
    setVerified(true);
    setSent(false);
    onVerified?.();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
      <Label htmlFor="profile-phone" className="font-semibold">
        Phone verification
      </Label>
      <div className="grid grid-cols-[104px_minmax(0,1fr)_auto] gap-2">
        <select
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
          disabled={verified}
          className="h-11 w-[104px] rounded-lg border border-input bg-background px-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
        >
          {countryCodes.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.code}
            </option>
          ))}
        </select>
        <Input
          id="profile-phone"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setVerified(false);
          }}
          type="tel"
          inputMode="numeric"
          placeholder="98765 43210"
          disabled={verified}
          className="h-11"
        />
        {!verified && (
          <Button type="button" variant="outline" onClick={sendCode} disabled={pending}>
            {sent ? "Resend" : "Verify"}
          </Button>
        )}
      </div>
      {verified ? (
        <p className="text-sm text-primary">✓ Phone number verified</p>
      ) : sent ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="4-digit code"
            className="h-11 tracking-[0.3em]"
          />
          <Button type="button" onClick={verify} disabled={pending}>
            Confirm
          </Button>
        </div>
      ) : null}
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
}
