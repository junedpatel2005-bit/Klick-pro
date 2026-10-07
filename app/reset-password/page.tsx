import { Suspense } from "react";
import ResetPassword from "@/routes/reset-password";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
