import { Suspense } from "react";
import Verify from "@/routes/verify";

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}
