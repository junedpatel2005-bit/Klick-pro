import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import ProfessionalHome from "@/routes/professional-home";
import { readMarketingContent } from "@/lib/marketing-cms";

export default async function ProfessionalHomePage() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }
  if (session.role !== "PROFESSIONAL") redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      emailVerifiedAt: true,
      professionalCategory: true,
      professionalLatitude: true,
      professionalLongitude: true,
    },
  });

  if (!user?.emailVerifiedAt) redirect("/verify");
  if (
    !user.professionalCategory ||
    user.professionalLatitude === null ||
    user.professionalLongitude === null
  ) {
    redirect("/professional/setup?profileSetup=1");
  }

  return <ProfessionalHome cmsContent={await readMarketingContent("professional-home")} />;
}
