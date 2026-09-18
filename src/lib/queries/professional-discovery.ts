import { db } from "@/lib/db";
import { getDistanceBoundingBox, getDistanceKm, createDisplayPoint } from "@/lib/geo";
import type { Prisma } from "@/generated/prisma/client";
import type { ProfessionalDiscoveryResult } from "@/lib/types/professional-discovery";

export type ProfessionalDiscoveryFilter = {
  query?: string;
  segment?: string;
  parentCategoryId?: number;
  categoryId?: number;
  subcategoryId?: number;
  category?: string;
  city?: string;
  state?: string;
  district?: string;
  minRating?: number;
  verified?: boolean;
  availability?: string;
  distanceKm?: number;
  originLat?: number;
  originLng?: number;
  sort?: "recommended" | "rating" | "distance" | "most-reviewed" | "price";
  page?: number;
  limit?: number;
};

const MAX_RESULTS_PER_PAGE = 50;
const DEFAULT_RESULTS_PER_PAGE = 20;
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Delhi: { lat: 28.7041, lng: 77.1025 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Surat: { lat: 21.1702, lng: 72.8311 },
};
const STATE_COORDINATE_BOUNDS: Record<
  string,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  Gujarat: { minLat: 20.0, maxLat: 24.8, minLng: 68.0, maxLng: 74.5 },
};

async function getCategoryHierarchyMaps() {
  const hierarchy = await db.serviceCategory.findMany({
    select: { id: true, parentId: true, name: true },
  });
  const childrenByParent = new Map<number, number[]>();
  const parentById = new Map<number, number | null>();
  const nameById = new Map<number, string>();
  for (const item of hierarchy) {
    nameById.set(item.id, item.name);
    parentById.set(item.id, item.parentId);
    if (item.parentId !== null) {
      const children = childrenByParent.get(item.parentId) ?? [];
      children.push(item.id);
      childrenByParent.set(item.parentId, children);
    }
  }
  return { hierarchy, childrenByParent, parentById, nameById };
}

function resolveEligibleCategoryBranch(
  selectedId: number,
  childrenByParent: Map<number, number[]>,
  parentById: Map<number, number | null>,
  nameById: Map<number, string>,
) {
  const branchIds: number[] = [];
  const collectBranch = (id: number) => {
    branchIds.push(id);
    for (const childId of childrenByParent.get(id) ?? []) collectBranch(childId);
  };
  collectBranch(selectedId);

  // If selectedId is a sub-category, professionals who selected its parent category
  // (or any ancestor below the root segment) are also eligible for this sub-category.
  const ancestorIds: number[] = [];
  let currentParentId = parentById.get(selectedId);
  while (currentParentId != null) {
    const grandParent = parentById.get(currentParentId);
    if (grandParent !== undefined && grandParent !== null) {
      ancestorIds.push(currentParentId);
    }
    currentParentId = grandParent;
  }

  const allEligibleIds = Array.from(new Set([...branchIds, ...ancestorIds]));
  const allEligibleNames = allEligibleIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name));

  return { eligibleIds: allEligibleIds, eligibleNames: allEligibleNames };
}

async function buildSearchWhere(filter: ProfessionalDiscoveryFilter) {
  const where: Prisma.UserWhereInput = {
    role: "PROFESSIONAL",
    isActive: true,
  };
  if (filter.verified) {
    where.isVerified = true;
  }

  let parentCategoryId = filter.parentCategoryId;
  if (filter.segment && !parentCategoryId) {
    const parent = await db.serviceCategory.findFirst({
      where: { segment: filter.segment, parentId: null },
      select: { id: true },
    });
    parentCategoryId = parent?.id;
  }

  if (filter.categoryId || filter.subcategoryId || parentCategoryId) {
    const parent = parentCategoryId
      ? await db.serviceCategory.findFirst({
          where: { id: parentCategoryId, parentId: null },
          select: { id: true },
        })
      : null;
    const category = filter.categoryId
      ? await db.serviceCategory.findFirst({
          where: { id: filter.categoryId, parentId: parent?.id },
          select: { id: true },
        })
      : null;
    const subcategory = filter.subcategoryId
      ? await db.serviceCategory.findFirst({
          where: { id: filter.subcategoryId, parentId: category?.id },
          select: { id: true },
        })
      : null;

    if (!parent || (filter.categoryId && !category) || (filter.subcategoryId && !subcategory)) {
      where.AND = [{ id: -1 }];
    } else {
      const selectedId = subcategory?.id ?? category?.id ?? parent.id;
      const { childrenByParent, parentById, nameById } = await getCategoryHierarchyMaps();
      const { eligibleIds, eligibleNames } = resolveEligibleCategoryBranch(
        selectedId,
        childrenByParent,
        parentById,
        nameById,
      );
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { professionalCategoryId: { in: eligibleIds } },
            { professionalCategory: { in: eligibleNames } },
            { services: { some: { isActive: true, categoryId: { in: eligibleIds } } } },
          ],
        },
      ];
    }
  } else if (filter.category) {
    const { hierarchy, childrenByParent, parentById, nameById } = await getCategoryHierarchyMaps();
    const matched = hierarchy.find(
      (c) => c.name.toLowerCase() === filter.category!.trim().toLowerCase(),
    );
    if (matched) {
      const { eligibleIds, eligibleNames } = resolveEligibleCategoryBranch(
        matched.id,
        childrenByParent,
        parentById,
        nameById,
      );
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { professionalCategoryId: { in: eligibleIds } },
            { professionalCategory: { in: eligibleNames } },
            { services: { some: { isActive: true, categoryId: { in: eligibleIds } } } },
          ],
        },
      ];
    } else {
      where.professionalCategory = filter.category;
    }
  }

  if (filter.city) {
    where.professionalCity = filter.city;
  }

  if (filter.state) {
    const bounds = STATE_COORDINATE_BOUNDS[filter.state];
    if (bounds && !filter.district) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { professionalState: filter.state },
            {
              AND: [
                { professionalLatitude: { gte: bounds.minLat, lte: bounds.maxLat } },
                { professionalLongitude: { gte: bounds.minLng, lte: bounds.maxLng } },
              ],
            },
          ],
        },
      ];
    } else if (filter.district) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            {
              AND: [{ professionalState: filter.state }, { professionalDistrict: filter.district }],
            },
            // Keep existing profiles discoverable until they save the new
            // structured state/district fields in Profile Setup.
            { professionalCity: filter.district },
          ],
        },
      ];
    } else {
      where.professionalState = filter.state;
    }
  }

  if (filter.district && !(filter.state && STATE_COORDINATE_BOUNDS[filter.state])) {
    where.professionalDistrict = filter.district;
  }

  if (filter.availability) {
    where.availabilityStatus = filter.availability;
  }

  if (typeof filter.minRating === "number") {
    where.averageRating = { gte: filter.minRating };
  }

  if (filter.query?.trim()) {
    const term = filter.query.trim();
    where.OR = [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { professionalCategory: { contains: term, mode: "insensitive" } },
      { professionalCity: { contains: term, mode: "insensitive" } },
      { companyDescription: { contains: term, mode: "insensitive" } },
      { professionalSkillsJson: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildOrderBy(
  filter: ProfessionalDiscoveryFilter,
): Array<{ [key: string]: "asc" | "desc" }> {
  if (filter.sort === "rating") {
    return [{ averageRating: "desc" }, { reviewCount: "desc" }, { updatedAt: "desc" }];
  }
  if (filter.sort === "most-reviewed") {
    return [{ reviewCount: "desc" }, { averageRating: "desc" }, { updatedAt: "desc" }];
  }
  if (filter.sort === "price") {
    return [{ hourlyRate: "asc" }, { averageRating: "desc" }];
  }
  return [{ isVerified: "desc" }, { averageRating: "desc" }, { reviewCount: "desc" }];
}

function parseSkills(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((skill) => typeof skill === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function toPublicProfessional(
  professional: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    professionalCategory: string | null;
    professionalCity: string | null;
    professionalState: string | null;
    professionalDistrict: string | null;
    hourlyRate: number | null;
    averageRating: number;
    reviewCount: number;
    availabilityStatus: string;
    isVerified: boolean;
    professionalSkillsJson: string | null;
    companyDescription: string | null;
    professionalLatitude: number | null;
    professionalLongitude: number | null;
  },
  distanceKm: number | null,
): ProfessionalDiscoveryResult {
  const cityPoint = professional.professionalCity
    ? CITY_COORDINATES[professional.professionalCity.trim()]
    : undefined;
  const basePoint =
    professional.professionalLatitude !== null && professional.professionalLongitude !== null
      ? { lat: professional.professionalLatitude, lng: professional.professionalLongitude }
      : cityPoint;
  return {
    id: String(professional.id),
    name: `${professional.firstName} ${professional.lastName}`.trim(),
    title: professional.professionalCategory ?? "Professional",
    avatarUrl: professional.avatarUrl,
    verified: professional.isVerified,
    rating: professional.averageRating,
    reviewCount: professional.reviewCount,
    hourlyRate: professional.hourlyRate,
    location: professional.professionalDistrict
      ? `${professional.professionalDistrict}, ${professional.professionalState ?? ""}`.replace(
          /, $/,
          "",
        )
      : professional.professionalCity,
    approximateDistanceKm: distanceKm,
    availabilityStatus: professional.availabilityStatus,
    skills: parseSkills(professional.professionalSkillsJson),
    bio: professional.companyDescription,
    displayPoint: basePoint
      ? (createDisplayPoint(professional.id, basePoint.lat, basePoint.lng) ?? undefined)
      : undefined,
  };
}

type UserProfessionalRecord = {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  professionalCategory: string | null;
  professionalCity: string | null;
  professionalState: string | null;
  professionalDistrict: string | null;
  hourlyRate: number | null;
  averageRating: number;
  reviewCount: number;
  availabilityStatus: string;
  isVerified: boolean;
  professionalSkillsJson: string | null;
  companyDescription: string | null;
  professionalLatitude: number | null;
  professionalLongitude: number | null;
};

function applyDistanceFilter(
  professionals: UserProfessionalRecord[],
  originLat: number,
  originLng: number,
  distanceKm: number,
) {
  return professionals
    .map((professional) => {
      if (
        professional.professionalLatitude === null ||
        professional.professionalLongitude === null ||
        Number.isNaN(professional.professionalLatitude) ||
        Number.isNaN(professional.professionalLongitude)
      ) {
        return null;
      }
      const distance = getDistanceKm(
        originLat,
        originLng,
        professional.professionalLatitude,
        professional.professionalLongitude,
      );
      return { professional, distance };
    })
    .filter(
      (item): item is { professional: (typeof professionals)[number]; distance: number } =>
        item !== null && item.distance <= distanceKm,
    );
}

export async function searchProfessionals(filter: ProfessionalDiscoveryFilter) {
  const page = Math.max(filter.page ?? 1, 1);
  const limit = Math.min(
    Math.max(filter.limit ?? DEFAULT_RESULTS_PER_PAGE, 1),
    MAX_RESULTS_PER_PAGE,
  );
  const pageStart = (page - 1) * limit;
  const pageEnd = pageStart + limit;
  const useExactDistanceFiltering =
    typeof filter.distanceKm === "number" &&
    typeof filter.originLat === "number" &&
    typeof filter.originLng === "number";
  const useDistanceOrdering =
    filter.sort === "distance" &&
    typeof filter.originLat === "number" &&
    typeof filter.originLng === "number";

  const baseWhere = await buildSearchWhere(filter);
  if (useExactDistanceFiltering) {
    const originLat = filter.originLat!;
    const originLng = filter.originLng!;
    const distanceKm = filter.distanceKm!;
    const bbox = getDistanceBoundingBox(originLat, distanceKm);
    baseWhere.professionalLatitude = {
      gte: originLat - bbox.latDelta,
      lte: originLat + bbox.latDelta,
    };
    baseWhere.professionalLongitude = {
      gte: originLng - bbox.lngDelta,
      lte: originLng + bbox.lngDelta,
    };
    baseWhere.AND = [
      { professionalLatitude: { not: null } },
      { professionalLongitude: { not: null } },
    ];
  }

  const candidateTake =
    useExactDistanceFiltering || useDistanceOrdering ? Math.min(page * limit + 20, 200) : limit + 1;
  const candidateSkip = useExactDistanceFiltering || useDistanceOrdering ? 0 : pageStart;

  const candidateUsersQuery = {
    where: baseWhere,
    orderBy: buildOrderBy(filter),
    skip: candidateSkip,
    take: candidateTake,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      professionalCategory: true,
      professionalCity: true,
      professionalState: true,
      professionalDistrict: true,
      hourlyRate: true,
      averageRating: true,
      reviewCount: true,
      availabilityStatus: true,
      isVerified: true,
      professionalSkillsJson: true,
      companyDescription: true,
      professionalLatitude: true,
      professionalLongitude: true,
    },
  } as const;

  const professionals = (await db.user.findMany(candidateUsersQuery)) as UserProfessionalRecord[];

  let distanceFilteredResults: Array<{
    professional: UserProfessionalRecord;
    distance: number;
  }> | null = null;
  let sortedByDistanceResults: Array<{
    professional: UserProfessionalRecord;
    distance: number;
  }> | null = null;
  let pagedProfessionals: UserProfessionalRecord[] = professionals;

  if (useExactDistanceFiltering) {
    distanceFilteredResults = applyDistanceFilter(
      professionals,
      filter.originLat!,
      filter.originLng!,
      filter.distanceKm!,
    );

    if (useDistanceOrdering) {
      distanceFilteredResults.sort((a, b) => a.distance - b.distance);
    }

    pagedProfessionals = distanceFilteredResults
      .slice(pageStart, pageEnd)
      .map((item) => item.professional);
  } else if (useDistanceOrdering) {
    sortedByDistanceResults = professionals
      .map((professional) => {
        if (
          professional.professionalLatitude === null ||
          professional.professionalLongitude === null ||
          Number.isNaN(professional.professionalLatitude) ||
          Number.isNaN(professional.professionalLongitude)
        ) {
          return { professional, distance: Number.POSITIVE_INFINITY };
        }
        return {
          professional,
          distance: getDistanceKm(
            filter.originLat!,
            filter.originLng!,
            professional.professionalLatitude,
            professional.professionalLongitude,
          ),
        };
      })
      .sort((a, b) => a.distance - b.distance);

    pagedProfessionals = sortedByDistanceResults
      .slice(pageStart, pageEnd)
      .map((item) => item.professional);
  } else {
    pagedProfessionals = professionals.slice(0, limit);
  }

  const results = pagedProfessionals.map((professional) => {
    const distance =
      distanceFilteredResults?.find((item) => item.professional.id === professional.id)?.distance ??
      sortedByDistanceResults?.find((item) => item.professional.id === professional.id)?.distance ??
      null;
    return toPublicProfessional(
      professional,
      typeof distance === "number" && Number.isFinite(distance) ? distance : null,
    );
  });

  const total = await db.user.count({ where: baseWhere });
  const hasMore =
    useExactDistanceFiltering || useDistanceOrdering
      ? Boolean(
          (distanceFilteredResults?.length ??
            sortedByDistanceResults?.length ??
            professionals.length) > pageEnd,
        )
      : professionals.length > limit;

  return {
    professionals: results,
    total,
    page,
    limit,
    hasMore,
    facets: { cities: [], categories: [] },
  };
}
