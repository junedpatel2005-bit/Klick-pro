CREATE TABLE IF NOT EXISTS "SavedProfessional" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProfessional_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedProfessional_userId_professionalId_key" ON "SavedProfessional"("userId", "professionalId");
CREATE INDEX IF NOT EXISTS "SavedProfessional_userId_idx" ON "SavedProfessional"("userId");
CREATE INDEX IF NOT EXISTS "SavedProfessional_professionalId_idx" ON "SavedProfessional"("professionalId");

DO $$ BEGIN
  ALTER TABLE "SavedProfessional" ADD CONSTRAINT "SavedProfessional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SavedProfessional" ADD CONSTRAINT "SavedProfessional_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

