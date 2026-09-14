-- Baseline schema initialization for Servio
-- Creates initial enums, base tables, and core relations
-- Columns and tables introduced by later migrations belong to those migrations.

-- CreateEnums
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENT', 'PROFESSIONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JobUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JobWorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CmsPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Base Tables IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "industry" TEXT,
    "teamSize" TEXT,
    "companyDescription" TEXT,
    "address" TEXT,
    "professionalCategory" TEXT,
    "professionalCity" TEXT,
    "professionalSkillsJson" TEXT,
    "experienceYears" INTEGER,
    "hourlyRate" INTEGER,
    "fixedRate" INTEGER,
    "portfolioUrl" TEXT,
    "workPhotosJson" TEXT,
    "certificationsJson" TEXT,
    "tradeLicenseUrl" TEXT,
    "serviceArea" TEXT,
    "workMode" TEXT NOT NULL DEFAULT 'both',
    "serviceRadiusKm" INTEGER,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
    "savedLocationsJson" TEXT,
    "hiringNeedsJson" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "professionalLatitude" DOUBLE PRECISION,
    "professionalLongitude" DOUBLE PRECISION,
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "biometricType" TEXT,
    "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "projectActivityNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "industry" TEXT,
    "teamSize" TEXT,
    "companyDescription" TEXT,
    "address" TEXT NOT NULL,
    "profilePhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientSavedLocation" (
    "id" SERIAL NOT NULL,
    "clientProfileId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientSavedLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientHiringNeed" (
    "id" SERIAL NOT NULL,
    "clientProfileId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientHiringNeed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientJob" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" TEXT,
    "title" TEXT,
    "description" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "urgency" "JobUrgency" NOT NULL DEFAULT 'MEDIUM',
    "jobDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "workMode" "JobWorkMode" NOT NULL DEFAULT 'BOTH',
    "locationLabel" TEXT,
    "locationAddress" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourlyRate" INTEGER,
    "timingType" TEXT NOT NULL DEFAULT 'FIXED',
    CONSTRAINT "ClientJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FavoriteJob" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientJobAttachment" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "previewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientJobAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconName" TEXT NOT NULL DEFAULT '',
    "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Service" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProfessionalVerification" (
    "userId" INTEGER NOT NULL,
    "governmentIdUrl" TEXT,
    "licenseUrl" TEXT,
    "certificationsJson" TEXT,
    "insuranceUrl" TEXT,
    "selfieUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalVerification_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "cms_pages" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "status" "CmsPageStatus" NOT NULL DEFAULT 'DRAFT',
    "pageKey" TEXT NOT NULL DEFAULT '',
    "sections" TEXT NOT NULL DEFAULT '{}',
    "keywords" TEXT NOT NULL DEFAULT '',
    "ogTitle" TEXT NOT NULL DEFAULT '',
    "ogDescription" TEXT NOT NULL DEFAULT '',
    "ogImage" TEXT NOT NULL DEFAULT '',
    "canonicalUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cms_page_versions" (
    "id" SERIAL NOT NULL,
    "page_id" INTEGER NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cms_page_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cms_media" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cms_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebsitePage" (
    "pageKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "CmsPageStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "css" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("pageKey")
);

CREATE TABLE IF NOT EXISTS "LegalPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "CmsPageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE IF NOT EXISTS "hire_jobs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "budget_min" INTEGER,
    "budget_max" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "job_type" TEXT,
    "city" TEXT,
    "job_date" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "urgency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_id" INTEGER,
    CONSTRAINT "hire_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hire_contracts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "client_project_id" INTEGER,
    "tracking_id" INTEGER,
    "total_amount" INTEGER,
    "platform_fee" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hire_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hire_job_attachments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "file_url" TEXT,
    "file_type" TEXT,
    "uploaded_by" TEXT,
    CONSTRAINT "hire_job_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hire_milestones" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "title" TEXT,
    "amount" INTEGER,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_proof" TEXT,
    CONSTRAINT "hire_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "direct_hire_negotiations" (
    "id" SERIAL NOT NULL,
    "contractId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "bidAmount" INTEGER,
    "duration" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direct_hire_negotiations_pkey" PRIMARY KEY ("id")
);

-- These base tables are referenced by the payout and integrity migrations.
CREATE TABLE IF NOT EXISTS "ProjectWithdrawal" (
    "id" SERIAL NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "destinationType" TEXT NOT NULL,
    "destinationLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectReview" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "professionalResponse" TEXT,
    "professionalResponseAt" TIMESTAMP(3),
    CONSTRAINT "ProjectReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadataJson" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "provider_reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "amount" INTEGER NOT NULL,
    "base_amount" INTEGER NOT NULL DEFAULT 0,
    "client_fee_amount" INTEGER NOT NULL DEFAULT 0,
    "professional_payout_amount" INTEGER NOT NULL DEFAULT 0,
    "admin_net_amount" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_professionalId_idx" ON "ProjectWithdrawal"("professionalId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectReview_trackingId_key" ON "ProjectReview"("trackingId");
CREATE INDEX IF NOT EXISTS "ProjectReview_clientId_idx" ON "ProjectReview"("clientId");
CREATE INDEX IF NOT EXISTS "ProjectReview_professionalId_idx" ON "ProjectReview"("professionalId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_name_key" ON "ServiceCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_slug_key" ON "ServiceCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "FavoriteJob_userId_jobId_key" ON "FavoriteJob"("userId", "jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_slug_key" ON "cms_pages"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "cms_page_versions_page_id_version_no_key" ON "cms_page_versions"("page_id", "version_no");
CREATE UNIQUE INDEX IF NOT EXISTS "WebsitePage_path_key" ON "WebsitePage"("path");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_idempotency_key_key" ON "WalletTransaction"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_provider_reference_key" ON "WalletTransaction"("provider_reference");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
