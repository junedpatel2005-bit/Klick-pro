import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verifySession, sessionCookie } from "@/lib/auth";
import { ClientProfilePage as ClientProfile } from "@/components/ClientProfilePage";
import { db } from "@/lib/db";

async function getCookieValue(name: string) {
  const cookieHeader = (await headers()).get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? match.slice(name.length + 1) : null;
}

export default async function ClientProfilePage() {
  const token = await getCookieValue(sessionCookie);
  if (!token) return redirect("/login");

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return redirect("/login");
  }

  if (session.role !== "CLIENT") {
    if (session.role === "PROFESSIONAL") return redirect("/professional-profile");
    if (session.role === "ADMIN") return redirect("/admin");
    return redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) return redirect("/verify");

  return <ClientProfile />;
}
