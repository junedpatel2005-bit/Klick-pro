-- AlterTable User: add razorpay_contact_id
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "razorpay_contact_id" TEXT;

-- AlterTable user_linked_accounts: add razorpay_fund_account_id
ALTER TABLE "user_linked_accounts" ADD COLUMN IF NOT EXISTS "razorpay_fund_account_id" TEXT;

-- AlterTable ProjectWithdrawal: add payout_mode and utr
ALTER TABLE "ProjectWithdrawal" ADD COLUMN IF NOT EXISTS "payout_mode" TEXT;
ALTER TABLE "ProjectWithdrawal" ADD COLUMN IF NOT EXISTS "utr" TEXT;

-- CreateIndex on User
CREATE INDEX IF NOT EXISTS "User_razorpay_contact_id_idx" ON "User"("razorpay_contact_id");

-- CreateIndex on ProjectWithdrawal for fast webhook & UTR reconciliation
CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_provider_transfer_id_idx" ON "ProjectWithdrawal"("provider_transfer_id");
CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_utr_idx" ON "ProjectWithdrawal"("utr");
CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_status_idx" ON "ProjectWithdrawal"("status");
CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_professionalId_status_idx" ON "ProjectWithdrawal"("professionalId", "status");

-- CreateIndex on user_linked_accounts for fast default lookup & webhook sync
CREATE INDEX IF NOT EXISTS "user_linked_accounts_user_id_is_default_idx" ON "user_linked_accounts"("user_id", "is_default");
CREATE INDEX IF NOT EXISTS "user_linked_accounts_razorpay_fund_account_id_idx" ON "user_linked_accounts"("razorpay_fund_account_id");
CREATE INDEX IF NOT EXISTS "user_linked_accounts_upi_id_idx" ON "user_linked_accounts"("upi_id");
