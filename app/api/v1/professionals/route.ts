import { NextResponse } from "next/server";
import { z } from "zod";
import { searchProfessionals } from "@/lib/queries/professional-discovery";

const querySchema = z.object({
  query: z.string().trim().max(200).optional(),
  segment: z.string().trim().max(50).optional(),
  parentCategoryId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  subcategoryId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verified: z.coerce.boolean().optional(),
  availability: z.string().trim().max(60).optional(),
  distanceKm: z.coerce.number().positive().max(500).optional(),
  originLat: z.coerce.number().optional(),
  originLng: z.coerce.number().optional(),
  sort: z.enum(["recommended", "rating", "distance", "most-reviewed", "price"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: issue.message, details: issue } },
        { status: 400 },
      );
    }

    if ((parsed.data.distanceKm ?? null) !== null) {
      if (parsed.data.originLat === undefined || parsed.data.originLng === undefined) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Distance filtering requires originLat and originLng.",
              details: {},
            },
          },
          { status: 400 },
        );
      }
    }

    const data = await searchProfessionals(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("api.v1.professionals.GET.error", { error });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to load professionals." } },
      { status: 500 },
    );
  }
}
