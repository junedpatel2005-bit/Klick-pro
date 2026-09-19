-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENT', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "JobUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "JobWorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'BOTH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CmsPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "cms_pages" (
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
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_versions" (
    "id" SERIAL NOT NULL,
    "page_id" INTEGER NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SQLiteMigrationTableArchive" (
    "sourceTable" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SQLiteMigrationTableArchive_pkey" PRIMARY KEY ("sourceTable")
);

-- CreateTable
CREATE TABLE "SQLiteMigrationAudit" (
    "sourceTable" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "archivedCount" INTEGER NOT NULL,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SQLiteMigrationAudit_pkey" PRIMARY KEY ("sourceTable")
);

-- CreateTable
CREATE TABLE "WebsitePage" (
    "pageKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "CmsPageStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "css" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("pageKey")
);

-- CreateTable
CREATE TABLE "LegalPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "CmsPageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconName" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "parentId" INTEGER,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professionalLatitude" DOUBLE PRECISION,
    "professionalLongitude" DOUBLE PRECISION,
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "biometricType" TEXT,
    "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "projectActivityNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phoneVerifiedAt" TIMESTAMP(3),
    "username" TEXT,
    "razorpay_account_id" TEXT,
    "professionalState" TEXT,
    "professionalDistrict" TEXT,
    "professional_category_id" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSavedLocation" (
    "id" SERIAL NOT NULL,
    "clientProfileId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientSavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientHiringNeed" (
    "id" SERIAL NOT NULL,
    "clientProfileId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientHiringNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientJob" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hourlyRate" INTEGER,
    "timingType" TEXT NOT NULL DEFAULT 'FIXED',
    "paymentMethod" TEXT NOT NULL DEFAULT 'WALLET',
    "locationState" TEXT,
    "locationDistrict" TEXT,

    CONSTRAINT "ClientJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteJob" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientJobAttachment" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "previewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientJobAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientJobMilestone" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "percentage" INTEGER NOT NULL,
    "amount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientJobMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTransaction" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "milestoneId" INTEGER,
    "completionId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNegotiation" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderRole" TEXT NOT NULL,
    "bidAmount" INTEGER,
    "duration" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousBidAmount" INTEGER,
    "previousDuration" TEXT,
    "previousMessage" TEXT,

    CONSTRAINT "ProjectNegotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReview" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "clientReviewedAt" TIMESTAMP(3),
    "professionalRating" INTEGER,
    "professionalComment" TEXT,
    "professionalReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professionalResponse" TEXT,
    "professionalResponseAt" TIMESTAMP(3),

    CONSTRAINT "ProjectReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRequest" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "coverLetter" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attachmentsJson" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'CLIENT_HIRE',

    CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTracking" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY_TO_START',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTimelineEvent" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "milestoneId" INTEGER,
    "actorId" INTEGER NOT NULL,
    "actorRole" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "progress" INTEGER,
    "stage" TEXT,
    "attachmentJson" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorkUpload" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "filesJson" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "milestoneId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',

    CONSTRAINT "ProjectWorkUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hire_jobs" (
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

-- CreateTable
CREATE TABLE "hire_contracts" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hire_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hire_job_attachments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "file_url" TEXT,
    "file_type" TEXT,
    "uploaded_by" TEXT,

    CONSTRAINT "hire_job_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hire_milestones" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "title" TEXT,
    "amount" INTEGER,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_proof" TEXT,

    CONSTRAINT "hire_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectHireNegotiation" (
    "id" SERIAL NOT NULL,
    "contractId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "bidAmount" DOUBLE PRECISION,
    "duration" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectHireNegotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketConversation" (
    "id" TEXT NOT NULL,
    "userAId" INTEGER NOT NULL,
    "userBId" INTEGER NOT NULL,
    "userAName" TEXT NOT NULL,
    "userBName" TEXT NOT NULL,
    "userAAvatarUrl" TEXT,
    "userBAvatarUrl" TEXT,
    "job" TEXT NOT NULL DEFAULT 'Direct message',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocketConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "SocketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketConversationClear" (
    "conversationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocketConversationClear_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "conversationId" TEXT NOT NULL,
    "startedBy" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "offerSdp" TEXT,
    "answerSdp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "MessageConversation" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "contractId" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "MessageConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationState" (
    "userId" INTEGER NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "UserNotificationState_pkey" PRIMARY KEY ("userId","notificationKey")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "amount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "project_tracking_id" INTEGER,
    "milestone_id" INTEGER,
    "captured_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "base_amount" INTEGER NOT NULL DEFAULT 0,
    "client_fee_amount" INTEGER NOT NULL DEFAULT 0,
    "professional_payout_amount" INTEGER NOT NULL DEFAULT 0,
    "admin_net_amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razorpay_webhook_events" (
    "id" SERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processing_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_started_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,
    "provider_reference" TEXT,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWithdrawal" (
    "id" SERIAL NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "destinationType" TEXT NOT NULL,
    "destinationLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payment_id" INTEGER,
    "provider_transfer_id" TEXT,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "ProjectWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "commission_amount" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDispute" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reporterRole" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "issueType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT NOT NULL,
    "attachmentsJson" TEXT DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_dispute_messages" (
    "id" SERIAL NOT NULL,
    "dispute_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "sender_role" TEXT NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCompletionRequest" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCompletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRevisionRequest" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRevisionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReviewRequest" (
    "id" SERIAL NOT NULL,
    "trackingId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalVerification" (
    "userId" INTEGER NOT NULL,
    "governmentIdUrl" TEXT,
    "licenseUrl" TEXT,
    "certificationsJson" TEXT,
    "insuranceUrl" TEXT,
    "selfieUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalVerification_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "verification_document_reviews" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "documentKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'persona',
    "provider_inquiry_id" TEXT NOT NULL,
    "provider_status" TEXT NOT NULL,
    "last_provider_event_at" TIMESTAMP(3),
    "admin_status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_webhook_events" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'persona',
    "provider_event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_configurations" (
    "id" SERIAL NOT NULL,
    "pageId" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "publishedConfig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "page_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_page_overrides" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "html" TEXT,
    "css" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_page_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_text_overrides" (
    "pagePath" TEXT NOT NULL,
    "elementKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_text_overrides_pkey" PRIMARY KEY ("pagePath","elementKey")
);

-- CreateTable
CREATE TABLE "legacy_users" (
    "id" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "isEmailVerified" BOOLEAN,
    "isPhoneVerified" BOOLEAN,
    "status" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "legacy_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_user_profiles" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "companyName" TEXT,
    "profilePhoto" TEXT,
    "address" TEXT,
    "bio" TEXT,
    "timezone" TEXT,
    "language" TEXT,

    CONSTRAINT "legacy_user_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "legacy_professional_details" (
    "userId" TEXT NOT NULL,
    "hourlyRate" INTEGER,
    "fixedRate" INTEGER,
    "experienceYears" INTEGER,
    "skills" TEXT,
    "serviceType" TEXT,
    "serviceRadiusKm" INTEGER,
    "availabilityStatus" TEXT,
    "portfolioUrl" TEXT,
    "isVerified" BOOLEAN,

    CONSTRAINT "legacy_professional_details_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "legacy_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "addressApprox" TEXT,
    "serviceRadiusKm" INTEGER,
    "isBaseLocation" BOOLEAN,

    CONSTRAINT "legacy_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_verifications" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "documentType" TEXT,
    "documentUrl" TEXT,
    "status" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "legacy_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_slug_idx" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_status_idx" ON "cms_pages"("status");

-- CreateIndex
CREATE INDEX "cms_page_versions_page_id_idx" ON "cms_page_versions"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_versions_page_id_version_no_key" ON "cms_page_versions"("page_id", "version_no");

-- CreateIndex
CREATE INDEX "cms_media_createdAt_idx" ON "cms_media"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_path_key" ON "WebsitePage"("path");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "ServiceCategory_parentId_idx" ON "ServiceCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_razorpay_account_id_key" ON "User"("razorpay_account_id");

-- CreateIndex
CREATE INDEX "User_professionalState_professionalDistrict_idx" ON "User"("professionalState", "professionalDistrict");

-- CreateIndex
CREATE INDEX "User_professional_category_id_idx" ON "User"("professional_category_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_idx" ON "ClientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSavedLocation_one_primary_idx" ON "ClientSavedLocation"("clientProfileId") WHERE ("isPrimary" = true);

-- CreateIndex
CREATE INDEX "ClientSavedLocation_clientProfileId_idx" ON "ClientSavedLocation"("clientProfileId");

-- CreateIndex
CREATE INDEX "ClientHiringNeed_clientProfileId_idx" ON "ClientHiringNeed"("clientProfileId");

-- CreateIndex
CREATE INDEX "ClientJob_userId_idx" ON "ClientJob"("userId");

-- CreateIndex
CREATE INDEX "ClientJob_status_idx" ON "ClientJob"("status");

-- CreateIndex
CREATE INDEX "ClientJob_locationState_locationDistrict_idx" ON "ClientJob"("locationState", "locationDistrict");

-- CreateIndex
CREATE INDEX "FavoriteJob_userId_idx" ON "FavoriteJob"("userId");

-- CreateIndex
CREATE INDEX "FavoriteJob_jobId_idx" ON "FavoriteJob"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteJob_userId_jobId_key" ON "FavoriteJob"("userId", "jobId");

-- CreateIndex
CREATE INDEX "ClientJobAttachment_jobId_idx" ON "ClientJobAttachment"("jobId");

-- CreateIndex
CREATE INDEX "ClientJobMilestone_jobId_idx" ON "ClientJobMilestone"("jobId");

-- CreateIndex
CREATE INDEX "ProjectTransaction_trackingId_idx" ON "ProjectTransaction"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectTransaction_clientId_idx" ON "ProjectTransaction"("clientId");

-- CreateIndex
CREATE INDEX "ProjectTransaction_professionalId_idx" ON "ProjectTransaction"("professionalId");

-- CreateIndex
CREATE INDEX "ProjectTransaction_status_idx" ON "ProjectTransaction"("status");

-- CreateIndex
CREATE INDEX "ProjectNegotiation_requestId_idx" ON "ProjectNegotiation"("requestId");

-- CreateIndex
CREATE INDEX "ProjectNegotiation_clientId_idx" ON "ProjectNegotiation"("clientId");

-- CreateIndex
CREATE INDEX "ProjectNegotiation_professionalId_idx" ON "ProjectNegotiation"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReview_trackingId_key" ON "ProjectReview"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectReview_clientId_idx" ON "ProjectReview"("clientId");

-- CreateIndex
CREATE INDEX "ProjectReview_professionalId_idx" ON "ProjectReview"("professionalId");

-- CreateIndex
CREATE INDEX "ProjectRequest_jobId_idx" ON "ProjectRequest"("jobId");

-- CreateIndex
CREATE INDEX "ProjectRequest_clientId_idx" ON "ProjectRequest"("clientId");

-- CreateIndex
CREATE INDEX "ProjectRequest_professionalId_idx" ON "ProjectRequest"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTracking_requestId_key" ON "ProjectTracking"("requestId");

-- CreateIndex
CREATE INDEX "ProjectTracking_jobId_idx" ON "ProjectTracking"("jobId");

-- CreateIndex
CREATE INDEX "ProjectTracking_clientId_idx" ON "ProjectTracking"("clientId");

-- CreateIndex
CREATE INDEX "ProjectTracking_professionalId_idx" ON "ProjectTracking"("professionalId");

-- CreateIndex
CREATE INDEX "ProjectTimelineEvent_trackingId_createdAt_idx" ON "ProjectTimelineEvent"("trackingId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectMilestone_trackingId_idx" ON "ProjectMilestone"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectWorkUpload_trackingId_idx" ON "ProjectWorkUpload"("trackingId");

-- CreateIndex
CREATE INDEX "hire_contracts_client_id_idx" ON "hire_contracts"("client_id");

-- CreateIndex
CREATE INDEX "hire_contracts_professional_id_idx" ON "hire_contracts"("professional_id");

-- CreateIndex
CREATE INDEX "hire_contracts_job_id_idx" ON "hire_contracts"("job_id");

-- CreateIndex
CREATE INDEX "hire_job_attachments_job_id_idx" ON "hire_job_attachments"("job_id");

-- CreateIndex
CREATE INDEX "hire_milestones_contract_id_idx" ON "hire_milestones"("contract_id");

-- CreateIndex
CREATE INDEX "DirectHireNegotiation_contractId_idx" ON "DirectHireNegotiation"("contractId");

-- CreateIndex
CREATE INDEX "DirectHireNegotiation_professionalId_idx" ON "DirectHireNegotiation"("professionalId");

-- CreateIndex
CREATE INDEX "SocketConversation_userAId_idx" ON "SocketConversation"("userAId");

-- CreateIndex
CREATE INDEX "SocketConversation_userBId_idx" ON "SocketConversation"("userBId");

-- CreateIndex
CREATE INDEX "SocketMessage_conversationId_idx" ON "SocketMessage"("conversationId");

-- CreateIndex
CREATE INDEX "SocketMessage_senderId_idx" ON "SocketMessage"("senderId");

-- CreateIndex
CREATE INDEX "SocketMessage_receiverId_idx" ON "SocketMessage"("receiverId");

-- CreateIndex
CREATE INDEX "MessageConversation_clientId_idx" ON "MessageConversation"("clientId");

-- CreateIndex
CREATE INDEX "MessageConversation_professionalId_idx" ON "MessageConversation"("professionalId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_order_id_key" ON "Payment"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_payment_id_key" ON "Payment"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_milestone_id_key" ON "Payment"("milestone_id");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX "Payment_professionalId_idx" ON "Payment"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_webhook_events_event_id_key" ON "razorpay_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "razorpay_webhook_events_processing_status_received_at_idx" ON "razorpay_webhook_events"("processing_status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotency_key_key" ON "WalletTransaction"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_provider_reference_key" ON "WalletTransaction"("provider_reference") WHERE (provider_reference IS NOT NULL);

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "ProjectWithdrawal_professionalId_idx" ON "ProjectWithdrawal"("professionalId");

-- CreateIndex
CREATE INDEX "ProjectWithdrawal_payment_id_idx" ON "ProjectWithdrawal"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_professional_id_idx" ON "invoices"("professional_id");

-- CreateIndex
CREATE INDEX "ProjectDispute_trackingId_idx" ON "ProjectDispute"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectDispute_clientId_idx" ON "ProjectDispute"("clientId");

-- CreateIndex
CREATE INDEX "ProjectDispute_professionalId_idx" ON "ProjectDispute"("professionalId");

-- CreateIndex
CREATE INDEX "project_dispute_messages_dispute_id_created_at_idx" ON "project_dispute_messages"("dispute_id", "created_at");

-- CreateIndex
CREATE INDEX "project_dispute_messages_recipient_id_created_at_idx" ON "project_dispute_messages"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "ProjectCompletionRequest_trackingId_idx" ON "ProjectCompletionRequest"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectRevisionRequest_trackingId_idx" ON "ProjectRevisionRequest"("trackingId");

-- CreateIndex
CREATE INDEX "ProjectReviewRequest_trackingId_idx" ON "ProjectReviewRequest"("trackingId");

-- CreateIndex
CREATE INDEX "verification_document_reviews_userId_idx" ON "verification_document_reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_document_reviews_userId_documentKey_key" ON "verification_document_reviews"("userId", "documentKey");

-- CreateIndex
CREATE UNIQUE INDEX "persona_verifications_provider_inquiry_id_key" ON "persona_verifications"("provider_inquiry_id");

-- CreateIndex
CREATE INDEX "persona_verifications_user_id_idx" ON "persona_verifications"("user_id");

-- CreateIndex
CREATE INDEX "persona_verifications_provider_status_idx" ON "persona_verifications"("provider_status");

-- CreateIndex
CREATE INDEX "persona_verifications_admin_status_idx" ON "persona_verifications"("admin_status");

-- CreateIndex
CREATE UNIQUE INDEX "persona_webhook_events_provider_event_id_key" ON "persona_webhook_events"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_idx" ON "StoredFile"("ownerId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_kind_idx" ON "ApiToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "OtpCode_phone_role_expiresAt_idx" ON "OtpCode"("phone", "role", "expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_phone_role_consumedAt_idx" ON "OtpCode"("phone", "role", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserSubscription_endpoint_key" ON "BrowserSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "BrowserSubscription_userId_idx" ON "BrowserSubscription"("userId");

-- CreateIndex
CREATE INDEX "Service_professionalId_idx" ON "Service"("professionalId");

-- CreateIndex
CREATE INDEX "page_configurations_pageId_idx" ON "page_configurations"("pageId");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_professional_category_id_fkey" FOREIGN KEY ("professional_category_id") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSavedLocation" ADD CONSTRAINT "ClientSavedLocation_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHiringNeed" ADD CONSTRAINT "ClientHiringNeed_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientJob" ADD CONSTRAINT "ClientJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteJob" ADD CONSTRAINT "FavoriteJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteJob" ADD CONSTRAINT "FavoriteJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientJobAttachment" ADD CONSTRAINT "ClientJobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientJobMilestone" ADD CONSTRAINT "ClientJobMilestone_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTracking" ADD CONSTRAINT "ProjectTracking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTracking" ADD CONSTRAINT "ProjectTracking_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTracking" ADD CONSTRAINT "ProjectTracking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTracking" ADD CONSTRAINT "ProjectTracking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelineEvent" ADD CONSTRAINT "ProjectTimelineEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkUpload" ADD CONSTRAINT "ProjectWorkUpload_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkUpload" ADD CONSTRAINT "ProjectWorkUpload_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hire_contracts" ADD CONSTRAINT "hire_contracts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "hire_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hire_job_attachments" ADD CONSTRAINT "hire_job_attachments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "hire_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hire_milestones" ADD CONSTRAINT "hire_milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "hire_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketMessage" ADD CONSTRAINT "SocketMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SocketConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketConversationClear" ADD CONSTRAINT "SocketConversationClear_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SocketConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectTrackingId_fkey" FOREIGN KEY ("project_tracking_id") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalVerification" ADD CONSTRAINT "ProfessionalVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_verifications" ADD CONSTRAINT "persona_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- PostgreSQL CHECK Constraints for Data Integrity
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_segment_check" CHECK ("segment" IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'));

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amount" >= 0),
  ADD CONSTRAINT "Payment_base_amount_nonnegative" CHECK ("base_amount" >= 0),
  ADD CONSTRAINT "Payment_client_fee_amount_nonnegative" CHECK ("client_fee_amount" >= 0),
  ADD CONSTRAINT "Payment_professional_payout_nonnegative" CHECK ("professional_payout_amount" >= 0),
  ADD CONSTRAINT "Payment_admin_net_nonnegative" CHECK ("admin_net_amount" >= 0);

ALTER TABLE "ProjectTracking"
  ADD CONSTRAINT "ProjectTracking_progress_check" CHECK ("progress" BETWEEN 0 AND 100);

ALTER TABLE "ProjectReview"
  ADD CONSTRAINT "ProjectReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "ProjectReview_professionalRating_check" CHECK ("professionalRating" IS NULL OR "professionalRating" BETWEEN 1 AND 5);

ALTER TABLE "User"
  ADD CONSTRAINT "User_averageRating_check" CHECK ("averageRating" BETWEEN 0 AND 5),
  ADD CONSTRAINT "User_reviewCount_nonnegative" CHECK ("reviewCount" >= 0);

ALTER TABLE "ClientJob"
  ADD CONSTRAINT "ClientJob_budget_order_check" CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax");

