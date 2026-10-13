import { ProfessionalProfileSetup } from "@/components/ProfessionalProfileSetup";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export default async function ProfessionalSetupPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) redirect("/login");
  const searchParams = props.searchParams ? await props.searchParams : {};
  const isAutoSetup = searchParams?.profileSetup === "1";
  const skipSetup = cookieStore.get("klick_skip_setup")?.value === "1";
  if (isAutoSetup && skipSetup) {
    redirect("/professional-home");
  }

  try {
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL") redirect("/login");
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) redirect("/verify");
  } catch {
    redirect("/login");
  }
  return <ProfessionalProfileSetup />;
}
