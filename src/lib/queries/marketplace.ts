import "server-only";
import { db } from "@/lib/db";
import { approximateAddress, createDisplayPoint } from "@/lib/geo";
import type {
  MarketplaceCategory,
  MarketplaceJob,
  MarketplaceProfessional,
  DetailedProfessional,
  PublicProfessionalProfile,
  ProfessionalService,
} from "@/lib/types/marketplace";

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

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function toProfessional(professional: {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  professionalCategory: string | null;
  professionalCity: string | null;
  professionalState?: string | null;
  hourlyRate: number | null;
  averageRating: number;
  reviewCount: number;
  availabilityStatus: string;
  isVerified: boolean;
  professionalSkillsJson: string | null;
  companyDescription: string | null;
}): MarketplaceProfessional {
  const locParts = [professional.professionalCity, professional.professionalState].filter(Boolean);
  return {
    id: String(professional.id),
    name: `${professional.firstName} ${professional.lastName}`.trim(),
    title: professional.professionalCategory ?? "Professional",
    avatar: professional.avatarUrl,
    rating: professional.averageRating,
    reviews: professional.reviewCount,
    hourlyRate: professional.hourlyRate,
    location: locParts.length > 0 ? locParts.join(", ") : (professional.professionalCity ?? null),
    availability: professional.availabilityStatus,
    verified: professional.isVerified,
    skills: parseSkills(professional.professionalSkillsJson),
    bio: professional.companyDescription,
  };
}

function toDetailedProfessional(professional: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  industry: string | null;
  teamSize: string | null;
  companyDescription: string | null;
  address: string | null;
  professionalCategory: string | null;
  professionalCity: string | null;
  professionalState: string | null;
  professionalDistrict: string | null;
  professionalSkillsJson: string | null;
  experienceYears: number | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  portfolioUrl: string | null;
  workPhotosJson: string | null;
  certificationsJson: string | null;
  tradeLicenseUrl: string | null;
  serviceArea: string | null;
  workMode: string;
  serviceRadiusKm: number | null;
  averageRating: number;
  reviewCount: number;
  isVerified: boolean;
  availabilityStatus: string;
  professionalLatitude: number | null;
  professionalLongitude: number | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  verification: {
    status: string | null;
    governmentIdUrl: string | null;
    licenseUrl: string | null;
    insuranceUrl: string | null;
    selfieUrl: string | null;
  } | null;
  services: {
    id: number;
    name: string;
    description: string;
    price: number | null;
    imageUrl: string | null;
    isActive: boolean;
  }[];
}): DetailedProfessional {
  const base = toProfessional({
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    avatarUrl: professional.avatarUrl,
    professionalCategory: professional.professionalCategory,
    professionalCity: professional.professionalCity,
    professionalState: professional.professionalState,
    hourlyRate: professional.hourlyRate,
    averageRating: professional.averageRating,
    reviewCount: professional.reviewCount,
    availabilityStatus: professional.availabilityStatus,
    isVerified: professional.isVerified,
    professionalSkillsJson: professional.professionalSkillsJson,
    companyDescription: professional.companyDescription,
  });

  return {
    ...base,
    firstName: professional.firstName,
    lastName: professional.lastName,
    email: professional.email,
    phone: professional.phone,
    companyName: professional.companyName,
    companyWebsite: professional.companyWebsite,
    industry: professional.industry,
    teamSize: professional.teamSize,
    address: professional.address,
    experienceYears: professional.experienceYears,
    fixedRate: professional.fixedRate,
    portfolioUrl: professional.portfolioUrl,
    workPhotos: parseJsonArray(professional.workPhotosJson),
    certifications: parseJsonArray(professional.certificationsJson),
    tradeLicenseUrl: professional.tradeLicenseUrl,
    serviceArea: professional.serviceArea,
    workMode: professional.workMode,
    serviceRadiusKm: professional.serviceRadiusKm,
    professionalLatitude: professional.professionalLatitude,
    professionalLongitude: professional.professionalLongitude,
    displayPoint:
      professional.professionalLatitude !== null && professional.professionalLongitude !== null
        ? (createDisplayPoint(
            professional.id,
            professional.professionalLatitude,
            professional.professionalLongitude,
          ) ?? undefined)
        : undefined,
    isActive: professional.isActive,
    lastLoginAt: professional.lastLoginAt?.toISOString() ?? null,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
    verificationStatus: professional.verification?.status ?? null,
    governmentIdUrl: professional.verification?.governmentIdUrl ?? null,
    licenseUrl: professional.verification?.licenseUrl ?? null,
    insuranceUrl: professional.verification?.insuranceUrl ?? null,
    selfieUrl: professional.verification?.selfieUrl ?? null,
    services: professional.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      imageUrl: s.imageUrl,
      isActive: s.isActive,
    })),
  };
}

export async function listCategories(): Promise<MarketplaceCategory[]> {
  const [categories, professionals] = await Promise.all([
    db.serviceCategory.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconName: true,
        segment: true,
        parentId: true,
      },
      orderBy: [{ segment: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    db.user.findMany({
      where: {
        role: "PROFESSIONAL",
        isActive: true,
      },
      select: {
        id: true,
        professionalCategory: true,
        professionalCategoryId: true,
        services: { where: { isActive: true }, select: { categoryId: true } },
      },
    }),
  ]);
  const categoryByName = new Map<string, number>();
  const childrenByParent = new Map<number, number[]>();
  const parentById = new Map<number, number | null>();
  for (const category of categories) {
    categoryByName.set(category.name.toLowerCase(), category.id);
    parentById.set(category.id, category.parentId);
    if (category.parentId === null) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }
  const categoryIdsForBranch = (categoryId: number) => {
    const ids = [categoryId];
    for (const childId of childrenByParent.get(categoryId) ?? []) {
      ids.push(...categoryIdsForBranch(childId));
    }
    return ids;
  };
  const counts = new Map<number, number>();
  for (const category of categories) {
    const branchIds = new Set(categoryIdsForBranch(category.id));
    let currParent = parentById.get(category.id);
    while (currParent != null) {
      const grandParent = parentById.get(currParent);
      if (grandParent !== undefined && grandParent !== null) {
        branchIds.add(currParent);
      }
      currParent = grandParent;
    }
    const count = professionals.filter((professional) => {
      const catId =
        professional.professionalCategoryId ??
        (professional.professionalCategory
          ? categoryByName.get(professional.professionalCategory.toLowerCase())
          : null);
      return (
        (catId !== null && catId !== undefined && branchIds.has(catId)) ||
        professional.services.some((service) => branchIds.has(service.categoryId))
      );
    }).length;
    counts.set(category.id, count);
  }
  return categories.map((category) => ({
    ...category,
    professionalCount: counts.get(category.id) ?? 0,
  }));
}

export async function listProfessionals(): Promise<MarketplaceProfessional[]> {
  const professionals = await db.user.findMany({
    where: { role: "PROFESSIONAL", isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      professionalCategory: true,
      professionalCity: true,
      hourlyRate: true,
      averageRating: true,
      reviewCount: true,
      availabilityStatus: true,
      isVerified: true,
      professionalSkillsJson: true,
      companyDescription: true,
    },
    orderBy: [{ isVerified: "desc" }, { averageRating: "desc" }],
    take: 50,
  });
  return professionals.map(toProfessional);
}

export async function listOpenJobs(): Promise<MarketplaceJob[]> {
  const [runningJobs, acceptedRequests] = await Promise.all([
    db.projectTracking.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { jobId: true },
    }),
    db.projectRequest.findMany({
      where: { status: "ACCEPTED" },
      select: { jobId: true },
    }),
  ]);
  const hiddenJobIds = new Set([
    ...runningJobs.map((project) => project.jobId),
    ...acceptedRequests.map((request) => request.jobId),
  ]);

  const jobs = await db.clientJob.findMany({
    where: {
      status: "OPEN",
      AND: [
        { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ],
      id: { notIn: [...hiddenJobIds] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      budgetMin: true,
      budgetMax: true,
      urgency: true,
      workMode: true,
      locationLabel: true,
      locationAddress: true,
      locationLat: true,
      locationLng: true,
      jobDate: true,
      deadline: true,
      timingType: true,
      hourlyRate: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true, averageRating: true } },
      _count: { select: { favoriteJobs: true } },
      attachments: {
        select: { id: true, fileName: true, fileType: true, fileSize: true, previewUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return jobs
    .filter((job): job is typeof job & { title: string; description: string; category: string } =>
      Boolean(job.title && job.description && job.category),
    )
    .map((job) => {
      const displayPoint =
        job.locationLat !== null && job.locationLng !== null
          ? createDisplayPoint(job.id, job.locationLat, job.locationLng)
          : null;
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        category: job.category,
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        urgency: job.urgency,
        workMode: job.workMode,
        location: job.locationLabel,
        locationAddress: approximateAddress(job.locationAddress),
        locationLat: displayPoint?.lat ?? null,
        locationLng: displayPoint?.lng ?? null,
        jobDate: job.jobDate?.toISOString() ?? null,
        deadline: job.deadline?.toISOString() ?? null,
        timingType: job.timingType as "FIXED" | "HOURLY",
        hourlyRate: job.hourlyRate,
        createdAt: job.createdAt.toISOString(),
        status: "OPEN" as const,
        proposalCount: job._count.favoriteJobs,
        client: {
          name: `${job.user.firstName} ${job.user.lastName}`.trim(),
          avatar: job.user.avatarUrl,
          rating: job.user.averageRating,
        },
        attachments: job.attachments,
      };
    });
}

export async function getProfessional(id: number): Promise<MarketplaceProfessional | null> {
  const professional = await db.user.findFirst({
    where: { id, role: "PROFESSIONAL", isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      professionalCategory: true,
      professionalCity: true,
      hourlyRate: true,
      averageRating: true,
      reviewCount: true,
      availabilityStatus: true,
      isVerified: true,
      professionalSkillsJson: true,
      companyDescription: true,
    },
  });
  return professional ? toProfessional(professional) : null;
}

export async function getDetailedProfessional(id: number): Promise<DetailedProfessional | null> {
  const professional = await db.user.findFirst({
    where: { id, role: "PROFESSIONAL", isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      companyName: true,
      companyWebsite: true,
      industry: true,
      teamSize: true,
      companyDescription: true,
      address: true,
      professionalCategory: true,
      professionalCity: true,
      professionalState: true,
      professionalDistrict: true,
      professionalSkillsJson: true,
      experienceYears: true,
      hourlyRate: true,
      fixedRate: true,
      portfolioUrl: true,
      workPhotosJson: true,
      certificationsJson: true,
      tradeLicenseUrl: true,
      serviceArea: true,
      workMode: true,
      serviceRadiusKm: true,
      averageRating: true,
      reviewCount: true,
      isVerified: true,
      availabilityStatus: true,
      professionalLatitude: true,
      professionalLongitude: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      verification: {
        select: {
          status: true,
          governmentIdUrl: true,
          licenseUrl: true,
          insuranceUrl: true,
          selfieUrl: true,
        },
      },
      services: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return professional ? toDetailedProfessional(professional) : null;
}

/**
 * Public marketplace profiles must never include contact details, verification documents,
 * exact coordinates, or security/account-activity fields.
 */
export async function getPublicProfessionalProfile(
  id: number,
): Promise<PublicProfessionalProfile | null> {
  const professional = await getDetailedProfessional(id);
  if (!professional) return null;
  const {
    email: _email,
    phone: _phone,
    address: _address,
    professionalLatitude: _professionalLatitude,
    professionalLongitude: _professionalLongitude,
    lastLoginAt: _lastLoginAt,
    governmentIdUrl: _governmentIdUrl,
    licenseUrl: _licenseUrl,
    insuranceUrl: _insuranceUrl,
    selfieUrl: _selfieUrl,
    ...publicProfile
  } = professional;
  return publicProfile;
}

export async function getOpenJob(id: number): Promise<MarketplaceJob | null> {
  const runningProject = await db.projectTracking.findFirst({
    where: { jobId: id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    select: { id: true },
  });
  if (runningProject) return null;

  const job = await db.clientJob.findFirst({
    where: {
      id,
      status: "OPEN",
      AND: [
        { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      budgetMin: true,
      budgetMax: true,
      urgency: true,
      workMode: true,
      locationLabel: true,
      locationAddress: true,
      locationLat: true,
      locationLng: true,
      jobDate: true,
      deadline: true,
      timingType: true,
      hourlyRate: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true, averageRating: true } },
      _count: { select: { favoriteJobs: true } },
      attachments: {
        select: { id: true, fileName: true, fileType: true, fileSize: true, previewUrl: true },
      },
      milestones: {
        select: {
          id: true,
          title: true,
          description: true,
          percentage: true,
          amount: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!job || !job.title || !job.description || !job.category) return null;
  const displayPoint =
    job.locationLat !== null && job.locationLng !== null
      ? createDisplayPoint(job.id, job.locationLat, job.locationLng)
      : null;
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    category: job.category,
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    urgency: job.urgency,
    workMode: job.workMode,
    location: job.locationLabel,
    locationAddress: approximateAddress(job.locationAddress),
    locationLat: displayPoint?.lat ?? null,
    locationLng: displayPoint?.lng ?? null,
    jobDate: job.jobDate?.toISOString() ?? null,
    deadline: job.deadline?.toISOString() ?? null,
    timingType: job.timingType as "FIXED" | "HOURLY",
    hourlyRate: job.hourlyRate,
    createdAt: job.createdAt.toISOString(),
    status: "OPEN",
    proposalCount: job._count.favoriteJobs,
    client: {
      name: `${job.user.firstName} ${job.user.lastName}`.trim(),
      avatar: job.user.avatarUrl,
      rating: job.user.averageRating,
    },
    attachments: job.attachments,
    milestones: job.milestones,
  };
}
