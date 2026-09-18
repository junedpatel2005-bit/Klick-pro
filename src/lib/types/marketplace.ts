export type MarketplaceProfessional = {
  id: string;
  name: string;
  title: string;
  avatar: string | null;
  rating: number;
  reviews: number;
  hourlyRate: number | null;
  location: string | null;
  availability: string;
  verified: boolean;
  skills: string[];
  bio: string | null;
  approximateDistanceKm?: number | null;
  /** Fuzzed to a nearby point for privacy — never the professional's exact location. */
  displayPoint?: { lat: number; lng: number };
};

export type DetailedProfessional = MarketplaceProfessional & {
  // Additional fields from User model
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  industry: string | null;
  teamSize: string | null;
  experienceYears: number | null;
  fixedRate: number | null;
  portfolioUrl: string | null;
  address: string | null;
  workPhotos: string[];
  certifications: string[];
  tradeLicenseUrl: string | null;
  serviceArea: string | null;
  workMode: string;
  serviceRadiusKm: number | null;
  professionalLatitude: number | null;
  professionalLongitude: number | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Verification
  verificationStatus: string | null;
  governmentIdUrl: string | null;
  licenseUrl: string | null;
  insuranceUrl: string | null;
  selfieUrl: string | null;
  // Services
  services: ProfessionalService[];
};

/** Fields that are safe to expose on the public professional marketplace profile. */
export type PublicProfessionalProfile = Omit<
  DetailedProfessional,
  | "email"
  | "phone"
  | "address"
  | "professionalLatitude"
  | "professionalLongitude"
  | "lastLoginAt"
  | "governmentIdUrl"
  | "licenseUrl"
  | "insuranceUrl"
  | "selfieUrl"
>;

export type ProfessionalService = {
  id: number;
  name: string;
  description: string;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
};

export type MarketplaceCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment: string;
  parentId: number | null;
  professionalCount: number;
};

export type MarketplaceJobMilestone = {
  id: number;
  title: string;
  description: string | null;
  percentage: number;
  amount: number | null;
  sortOrder: number;
};

export type MarketplaceJob = {
  id: number;
  title: string;
  description: string;
  category: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  workMode: "ON_SITE" | "REMOTE" | "BOTH";
  location: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  jobDate: string | null;
  deadline: string | null;
  timingType: "FIXED" | "HOURLY";
  hourlyRate: number | null;
  createdAt: string;
  status: "OPEN" | "CLOSED" | "DRAFT";
  proposalCount: number;
  client: { name: string; avatar: string | null; rating: number };
  attachments: {
    id: number;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    previewUrl: string | null;
  }[];
  milestones?: MarketplaceJobMilestone[];
};
