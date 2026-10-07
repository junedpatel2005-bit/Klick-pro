import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";

/**
 * /project/* sits outside the (portal) group, so it needs its own authoritative
 * session check: the proxy only verifies the JWT signature. The pages below are
 * client components and cannot enforce this themselves.
 */
export default async function ProjectLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(sessionCookie)?.value;
  let session = null;
  try {
    session = token ? await verifySession(token) : null;
  } catch {
    session = null;
  }
  if (!session) redirect("/login");

  return <>{children}</>;
}
