DO $$
BEGIN
  IF to_regclass('"hire_jobs"') IS NOT NULL THEN
    ALTER TABLE "hire_jobs"
      ALTER COLUMN "budget_min" TYPE INTEGER USING ROUND("budget_min")::INTEGER,
      ALTER COLUMN "budget_max" TYPE INTEGER USING ROUND("budget_max")::INTEGER;
  END IF;
  IF to_regclass('"hire_contracts"') IS NOT NULL THEN
    ALTER TABLE "hire_contracts"
      ALTER COLUMN "total_amount" TYPE INTEGER USING ROUND("total_amount")::INTEGER,
      ALTER COLUMN "platform_fee" TYPE INTEGER USING ROUND("platform_fee")::INTEGER;
  END IF;
  IF to_regclass('"hire_milestones"') IS NOT NULL THEN
    ALTER TABLE "hire_milestones"
      ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;
  END IF;
  IF to_regclass('"direct_hire_negotiations"') IS NOT NULL THEN
    ALTER TABLE "direct_hire_negotiations"
      ALTER COLUMN "bidAmount" TYPE INTEGER USING ROUND("bidAmount")::INTEGER;
  END IF;
  IF to_regclass('"legacy_professional_details"') IS NOT NULL THEN
    ALTER TABLE "legacy_professional_details"
      ALTER COLUMN "hourlyRate" TYPE INTEGER USING ROUND("hourlyRate")::INTEGER,
      ALTER COLUMN "fixedRate" TYPE INTEGER USING ROUND("fixedRate")::INTEGER;
  END IF;
END $$;
