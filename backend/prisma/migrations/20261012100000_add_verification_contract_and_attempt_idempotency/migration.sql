CREATE TYPE "VerificationType" AS ENUM ('KINEMATICS', 'NEWTONS_SECOND_LAW', 'KINETIC_ENERGY');

ALTER TABLE "SeedProblem"
  ADD COLUMN "verificationType" "VerificationType" NOT NULL DEFAULT 'KINEMATICS',
  ADD COLUMN "verificationParams" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "StudentAttempt"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "StudentAttempt_userId_idempotencyKey_key"
  ON "StudentAttempt"("userId", "idempotencyKey");
