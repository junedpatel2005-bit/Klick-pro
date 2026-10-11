import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import JobDetails from "@/routes/job.$jobId";

export default async function ProfessionalJobsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const numJobId = Number(jobId);

  if (!isNaN(numJobId) && numJobId > 0) {
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookie)?.value;
    if (token) {
      try {
        const session = await verifySession(token);
        if (session.role === "PROFESSIONAL") {
          // If proposal was accepted and project exists, redirect directly to project tracking
          const project = await db.projectTracking.findFirst({
            where: { jobId: numJobId, professionalId: session.userId },
            select: { id: true },
          });
          if (project) {
            redirect(`/project/${project.id}/tracking`);
          }
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
      }
    }
  }

  return <JobDetails initialViewerRole="PROFESSIONAL" />;
}
