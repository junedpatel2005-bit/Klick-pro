import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOpenJob,
  getProfessional,
  getPublicProfessionalProfile,
  listCategories,
  listOpenJobs,
  listProfessionals,
} from "@/lib/queries/marketplace";

const idSchema = z.coerce.number().int().positive();

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  try {
    if (resource === "categories") return NextResponse.json(await listCategories());
    if (resource === "professionals") return NextResponse.json(await listProfessionals());
    if (resource === "jobs") return NextResponse.json(await listOpenJobs());
    if (resource === "professional") {
      const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
      if (!id.success)
        return NextResponse.json(
          { error: "A valid professional id is required." },
          { status: 400 },
        );
      const professional = await getProfessional(id.data);
      return professional
        ? NextResponse.json(professional)
        : NextResponse.json({ error: "Professional not found." }, { status: 404 });
    }
    if (resource === "professional-detail") {
      const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
      if (!id.success)
        return NextResponse.json(
          { error: "A valid professional id is required." },
          { status: 400 },
        );
      const professional = await getPublicProfessionalProfile(id.data);
      return professional
        ? NextResponse.json(professional)
        : NextResponse.json({ error: "Professional not found." }, { status: 404 });
    }
    if (resource === "job") {
      const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
      if (!id.success)
        return NextResponse.json({ error: "A valid job id is required." }, { status: 400 });
      const job = await getOpenJob(id.data);
      return job
        ? NextResponse.json(job)
        : NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("marketplace.request.failed", { resource, error });
    return NextResponse.json({ error: "Unable to load marketplace data." }, { status: 500 });
  }
}
