export type ProfessionalDiscoveryAvailability = string;

export type ProfessionalDiscoveryResult = {
  id: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  verified: boolean;
  rating: number;
  reviewCount: number;
  hourlyRate: number | null;
  location: string | null;
  approximateDistanceKm: number | null;
  availabilityStatus: string;
  skills: string[];
  bio: string | null;
  displayPoint?: {
    lat: number;
    lng: number;
  };
};

export type ProfessionalDiscoveryFacetItem = {
  value: string;
  count: number;
};

export type ProfessionalDiscoveryResponse = {
  professionals: ProfessionalDiscoveryResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  facets: {
    cities: ProfessionalDiscoveryFacetItem[];
    categories: ProfessionalDiscoveryFacetItem[];
  };
};

export type ProfessionalDiscoveryFilters = {
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
