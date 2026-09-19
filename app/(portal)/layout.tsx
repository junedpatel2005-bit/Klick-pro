import { PortalShell, PortalTitleProvider } from "@/components/PortalShell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");

  // verifySession already joins the user row and rejects revoked sessions and
  // inactive users, so no second lookup is needed here. Redirects stay outside
  // the try block: redirect() signals by throwing, and catching it here would
  // turn every redirect into the /login fallback.
  let session;
  try {
    session = await verifySession(token);
  } catch {
    session = null;
  }
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && !session.emailVerifiedAt) redirect("/verify");

  const portalUser = {
    firstName: session.firstName,
    lastName: session.lastName,
    role: session.role as string,
    avatarUrl: session.avatarUrl,
  };

  return (
    <PortalTitleProvider>
      <PortalShell initialUser={portalUser}>{children}</PortalShell>
    </PortalTitleProvider>
  );
}
