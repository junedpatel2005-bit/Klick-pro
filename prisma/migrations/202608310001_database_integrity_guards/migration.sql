-- Safety contract: this migration intentionally aborts when existing data violates
-- a proposed constraint. It never repairs, deletes, rounds, or merges rows.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" p LEFT JOIN "User" u ON u.id = p."clientId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "Payment" p LEFT JOIN "User" u ON u.id = p."professionalId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "Payment" p LEFT JOIN "ClientJob" j ON j.id = p."jobId" WHERE p."jobId" IS NOT NULL AND j.id IS NULL)
    OR EXISTS (SELECT 1 FROM "Payment" p LEFT JOIN "ProjectTracking" t ON t.id = p."project_tracking_id" WHERE p."project_tracking_id" IS NOT NULL AND t.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectRequest" r LEFT JOIN "ClientJob" j ON j.id = r."jobId" WHERE j.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectRequest" r LEFT JOIN "User" u ON u.id = r."clientId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectRequest" r LEFT JOIN "User" u ON u.id = r."professionalId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectTracking" t LEFT JOIN "ProjectRequest" r ON r.id = t."requestId" WHERE r.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectTracking" t LEFT JOIN "ClientJob" j ON j.id = t."jobId" WHERE j.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectTracking" t LEFT JOIN "User" u ON u.id = t."clientId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectTracking" t LEFT JOIN "User" u ON u.id = t."professionalId" WHERE u.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectMilestone" m LEFT JOIN "ProjectTracking" t ON t.id = m."trackingId" WHERE t.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectTimelineEvent" e LEFT JOIN "ProjectTracking" t ON t.id = e."trackingId" WHERE t.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectWorkUpload" w LEFT JOIN "ProjectTracking" t ON t.id = w."trackingId" WHERE t.id IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectWorkUpload" w LEFT JOIN "ProjectMilestone" m ON m.id = w."milestoneId" WHERE w."milestoneId" IS NOT NULL AND m.id IS NULL)
    OR EXISTS (SELECT 1 FROM "Service" s LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId" WHERE c.id IS NULL)
  THEN
    RAISE EXCEPTION 'MIGRATION REQUIRES CLEAN PREFLIGHT: relationship orphan rows exist';
  END IF;

  IF EXISTS (SELECT 1 FROM "ClientProfile" GROUP BY "userId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "ClientSavedLocation" WHERE "isPrimary" GROUP BY "clientProfileId" HAVING count(*) > 1)
  THEN
    RAISE EXCEPTION 'MIGRATION REQUIRES CLEAN PREFLIGHT: uniqueness violations exist';
  END IF;

  IF EXISTS (SELECT 1 FROM "Payment" WHERE "amount" < 0 OR "professional_payout_amount" < 0 OR "admin_net_amount" < 0 OR "base_amount" < 0 OR "client_fee_amount" < 0)
    OR EXISTS (SELECT 1 FROM "ProjectTracking" WHERE "progress" NOT BETWEEN 0 AND 100)
    OR EXISTS (SELECT 1 FROM "ProjectReview" WHERE "rating" NOT BETWEEN 1 AND 5)
    OR EXISTS (SELECT 1 FROM "User" WHERE "averageRating" NOT BETWEEN 0 AND 5 OR "reviewCount" < 0)
    OR EXISTS (SELECT 1 FROM "ClientJob" WHERE "budgetMin" IS NOT NULL AND "budgetMax" IS NOT NULL AND "budgetMin" > "budgetMax")
  THEN
    RAISE EXCEPTION 'MIGRATION REQUIRES CLEAN PREFLIGHT: CHECK violations exist';
  END IF;
END $$;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_projectTrackingId_fkey" FOREIGN KEY ("project_tracking_id") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectRequest"
  ADD CONSTRAINT "ProjectRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectRequest_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectTracking"
  ADD CONSTRAINT "ProjectTracking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTracking_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTracking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTracking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectMilestone"
  ADD CONSTRAINT "ProjectMilestone_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectTimelineEvent"
  ADD CONSTRAINT "ProjectTimelineEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkUpload"
  ADD CONSTRAINT "ProjectWorkUpload_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "ProjectTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectWorkUpload_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amount" >= 0),
  ADD CONSTRAINT "Payment_base_amount_nonnegative" CHECK ("base_amount" >= 0),
  ADD CONSTRAINT "Payment_client_fee_amount_nonnegative" CHECK ("client_fee_amount" >= 0),
  ADD CONSTRAINT "Payment_professional_payout_nonnegative" CHECK ("professional_payout_amount" >= 0),
  ADD CONSTRAINT "Payment_admin_net_nonnegative" CHECK ("admin_net_amount" >= 0);

ALTER TABLE "ProjectTracking"
  ADD CONSTRAINT "ProjectTracking_progress_check" CHECK ("progress" BETWEEN 0 AND 100);

ALTER TABLE "ProjectReview"
  ADD CONSTRAINT "ProjectReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "User"
  ADD CONSTRAINT "User_averageRating_check" CHECK ("averageRating" BETWEEN 0 AND 5),
  ADD CONSTRAINT "User_reviewCount_nonnegative" CHECK ("reviewCount" >= 0);

ALTER TABLE "ClientJob"
  ADD CONSTRAINT "ClientJob_budget_order_check" CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax");

CREATE UNIQUE INDEX "ClientSavedLocation_one_primary_idx"
  ON "ClientSavedLocation" ("clientProfileId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "ClientProfile_userId_key"
  ON "ClientProfile" ("userId");
