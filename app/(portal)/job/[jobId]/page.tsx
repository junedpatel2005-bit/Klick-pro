import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie, verifySession } from "@/lib/auth";
import JobDetails from "@/routes/job.$jobId";

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  let viewerRole: "CLIENT" | "PROFESSIONAL" | null = null;

  if (token) {
    try {
      const session = await verifySession(token);
      if (session.role === "PROFESSIONAL") {
        redirect(`/professional/job/${jobId}`);
      }
      if (session.role === "CLIENT") {
        viewerRole = "CLIENT";
      }
    } catch {
      // Invalid session; treat as public viewer
    }
  }

  return <JobDetails initialViewerRole={viewerRole} />;
}
