-- CreateTable
CREATE TABLE IF NOT EXISTS "user_linked_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "account_type" TEXT NOT NULL,
    "account_holder" TEXT,
    "account_number" TEXT,
    "last_4" TEXT,
    "ifsc_code" TEXT,
    "bank_name" TEXT,
    "upi_id" TEXT,
    "card_bank" TEXT,
    "razorpay_account_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_linked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_linked_accounts_user_id_idx" ON "user_linked_accounts"("user_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_linked_accounts" ADD CONSTRAINT "user_linked_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

