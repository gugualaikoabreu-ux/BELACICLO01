-- Additive only: manual PIX review states and actor attribution for order history.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROOF_RECEIVED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNIDENTIFIED';

ALTER TABLE "order_events"
  ADD COLUMN IF NOT EXISTS "actorId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;
