import { ClientProfileSetup } from "@/components/ClientProfileSetup";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export default async function ClientSetupPage() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");
  try {
    const session = await verifySession(token);
    if (session.role !== "CLIENT") {
      if (session.role === "PROFESSIONAL") redirect("/professional/setup");
      if (session.role === "ADMIN") redirect("/admin");
      redirect("/login");
    }
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) redirect("/verify");
  } catch {
    redirect("/login");
  }
  return <ClientProfileSetup />;
}
