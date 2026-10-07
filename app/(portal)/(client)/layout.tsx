import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, sessionCookie } from "@/lib/auth";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }

  if (session.role === "PROFESSIONAL") redirect("/professional-profile");
  if (session.role === "ADMIN") redirect("/admin");

  return <>{children}</>;
}
