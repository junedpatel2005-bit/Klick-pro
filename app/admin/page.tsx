import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";
import Admin from "@/routes/admin/admin";
export default async function Page() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/admin/login");
  try {
    const session = await verifySession(token);
    if (session.role !== "ADMIN") redirect("/admin/login");
  } catch {
    redirect("/admin/login");
  }
  return <Admin />;
}
