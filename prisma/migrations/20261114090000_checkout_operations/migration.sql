-- Additive checkout operations: existing products, orders, coupons and users are preserved.
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

ALTER TABLE "coupons"
  ADD COLUMN "minimumSubtotalCents" INTEGER;

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_minimumSubtotalCents_check"
  CHECK ("minimumSubtotalCents" IS NULL OR "minimumSubtotalCents" > 0);

CREATE TABLE "coupon_redemptions" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "couponCode" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "discountCents" INTEGER NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_redemptions_discountCents_check" CHECK ("discountCents" > 0)
);

CREATE UNIQUE INDEX "coupon_redemptions_orderId_key" ON "coupon_redemptions"("orderId");
CREATE INDEX "coupon_redemptions_couponId_userId_status_idx" ON "coupon_redemptions"("couponId", "userId", "status");
CREATE INDEX "coupon_redemptions_userId_idx" ON "coupon_redemptions"("userId");
CREATE INDEX "coupon_redemptions_status_reservedAt_idx" ON "coupon_redemptions"("status", "reservedAt");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_redemptions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_redemptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "store_shipping_settings" (
  "id" TEXT NOT NULL DEFAULT 'store',
  "originPostalCode" TEXT,
  "fixedShippingCents" INTEGER,
  "freeShippingThresholdCents" INTEGER,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_shipping_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_shipping_settings_originPostalCode_check" CHECK ("originPostalCode" IS NULL OR "originPostalCode" ~ '^[0-9]{8}$'),
  CONSTRAINT "store_shipping_settings_fixedShippingCents_check" CHECK ("fixedShippingCents" IS NULL OR "fixedShippingCents" >= 0),
  CONSTRAINT "store_shipping_settings_freeShippingThresholdCents_check" CHECK ("freeShippingThresholdCents" IS NULL OR "freeShippingThresholdCents" >= 0)
);

-- These settings and redemption records are accessed by the trusted server only.
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_shipping_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "coupon_redemptions", "store_shipping_settings" FROM anon, authenticated;
