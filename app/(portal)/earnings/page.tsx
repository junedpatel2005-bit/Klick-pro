import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, sessionCookie } from "@/lib/auth";
import Earnings from "@/routes/professional/earnings";
import ClientEarnings from "@/routes/client/earnings";

async function getSessionTokenFromCookies() {
  return (await cookies()).get(sessionCookie)?.value;
}

async function ensureProfessionalAccess() {
  const token = await getSessionTokenFromCookies();
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }

  if (session.role !== "PROFESSIONAL" && session.role !== "CLIENT") {
    if (session.role === "ADMIN") redirect("/admin");
    redirect("/login");
  }
}

export default async function EarningsPage() {
  const token = await getSessionTokenFromCookies();
  if (!token) redirect("/login");
  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }
  if (session.role === "CLIENT") return <ClientEarnings />;
  if (session.role === "PROFESSIONAL") return <Earnings />;
  redirect("/admin");
}
