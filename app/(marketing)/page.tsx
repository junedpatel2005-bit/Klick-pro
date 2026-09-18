import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";
import Landing from "@/routes/index";
import { readHomeContent } from "@/lib/home-cms-file";

export default async function HomePage() {
  const token = (await cookies()).get(sessionCookie)?.value;
  let isAuthenticated = false;
  if (token) {
    let role: string | null = null;
    try {
      const session = await verifySession(token);
      role = session.role;
      isAuthenticated = true;
    } catch {
      // Invalid session — fall through to the public home.
    }
    if (role === "PROFESSIONAL") redirect("/professional-home");
  }
  return <Landing isAuthenticated={isAuthenticated} homeContent={await readHomeContent()} />;
}
