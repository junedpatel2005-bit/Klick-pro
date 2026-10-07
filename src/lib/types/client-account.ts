export type ClientSavedLocationSummary = {
  id: number;
  label: string;
  address: string;
  isPrimary: boolean;
};

export type ClientAccountProfileSummary = {
  fullName: string | null;
  companyName: string | null;
  address: string | null;
  profilePhotoUrl: string | null;
};

export type ClientJobCounts = {
  open: number;
  draft: number;
  closed: number;
};

export type ClientAccountSummaryResponse = {
  account: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    isActive: boolean;
  };
  profile: ClientAccountProfileSummary | null;
  savedLocations: ClientSavedLocationSummary[];
  jobCounts: ClientJobCounts;
  role: "CLIENT";
};
