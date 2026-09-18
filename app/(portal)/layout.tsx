import { PortalShell, PortalTitleProvider } from "@/components/PortalShell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");
  let portalUser: {
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
  } | null = null;
  try {
    const session = await verifySession(token);
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });
    if (!user?.isActive) redirect("/login");
    if (session.role !== "ADMIN" && !user.emailVerifiedAt) redirect("/verify");
    portalUser = {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    redirect("/login");
  }
  return (
    <PortalTitleProvider>
      <PortalShell initialUser={portalUser}>{children}</PortalShell>
    </PortalTitleProvider>
  );
}
