import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, sessionCookie } from "@/lib/auth";

async function ensureProfessionalAccess() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }

  if (session.role !== "PROFESSIONAL") {
    if (session.role === "CLIENT") redirect("/dashboard");
    if (session.role === "ADMIN") redirect("/admin");
    redirect("/login");
  }
}

export default async function ProfessionalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureProfessionalAccess();
  return <>{children}</>;
}
