import { Suspense } from "react";
import VerifyEmail from "@/routes/verify-email";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
