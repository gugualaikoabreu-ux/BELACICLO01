-- Additive regional shipping configuration, delivery estimate snapshots, and admin audit history.
ALTER TABLE "store_shipping_settings"
  ADD COLUMN "regionalShippingEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "curitibaMetroShippingCents" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "interiorParanaShippingCents" INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN "otherStatesShippingCents" INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN "fixedShippingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "correiosShippingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "estimatedMinDays" INTEGER,
  ADD COLUMN "estimatedMaxDays" INTEGER;

UPDATE "store_shipping_settings"
SET "fixedShippingEnabled" = ("fixedShippingCents" IS NOT NULL),
    "freeShippingEnabled" = ("freeShippingThresholdCents" IS NOT NULL);

ALTER TABLE "store_shipping_settings"
  ADD CONSTRAINT "store_shipping_settings_regional_rates_positive_check"
    CHECK ("curitibaMetroShippingCents" > 0 AND "interiorParanaShippingCents" > 0 AND "otherStatesShippingCents" > 0),
  ADD CONSTRAINT "store_shipping_settings_delivery_estimate_check"
    CHECK (("estimatedMinDays" IS NULL AND "estimatedMaxDays" IS NULL) OR
      ("estimatedMinDays" BETWEEN 1 AND 365 AND "estimatedMaxDays" BETWEEN "estimatedMinDays" AND 365));

INSERT INTO "store_shipping_settings" ("id", "originPostalCode", "createdAt", "updatedAt")
VALUES ('store', '81570001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "orders"
  ADD COLUMN "shippingDeliveryMinDays" INTEGER,
  ADD COLUMN "shippingDeliveryMaxDays" INTEGER,
  ADD CONSTRAINT "orders_shipping_delivery_estimate_check"
    CHECK (("shippingDeliveryMinDays" IS NULL AND "shippingDeliveryMaxDays" IS NULL) OR
      ("shippingDeliveryMinDays" BETWEEN 1 AND 365 AND "shippingDeliveryMaxDays" BETWEEN "shippingDeliveryMinDays" AND 365));

CREATE TABLE "shipping_settings_history" (
  "id" TEXT NOT NULL,
  "settingsId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "previousSettings" JSONB NOT NULL,
  "currentSettings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_settings_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_settings_history_settingsId_fkey"
    FOREIGN KEY ("settingsId") REFERENCES "store_shipping_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "shipping_settings_history_settingsId_createdAt_idx"
  ON "shipping_settings_history"("settingsId", "createdAt");

ALTER TABLE "shipping_settings_history" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "shipping_settings_history" FROM anon, authenticated;
