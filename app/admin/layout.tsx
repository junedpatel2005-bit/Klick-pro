import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPortal } from "@/components/AdminPortal";
import { sessionCookie, verifySession } from "@/lib/auth";

/**
 * Authoritative admin guard. The proxy only checks the JWT signature and its
 * role claim, so revocation and account status must be enforced here, where the
 * session row is actually read. verifySession is memoized per render pass, so
 * pages below this layout that verify again do not pay a second query.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (pathname !== "/admin/login") {
    const token = (await cookies()).get(sessionCookie)?.value;
    let session = null;
    try {
      session = token ? await verifySession(token) : null;
    } catch {
      session = null;
    }
    if (session?.role !== "ADMIN") redirect("/admin/login");
  }

  return <AdminPortal>{children}</AdminPortal>;
}
