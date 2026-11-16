import { getDb } from "@/lib/db";
import { getCorreiosSetupStatus, hasCorreiosSettings } from "@/lib/shipping/correios";
import { getConfiguredShippingCents, hasConfiguredShippingRate } from "@/lib/shipping/manual";
export { storeShippingAmount } from "@/lib/shipping/policy";

export type StoreShippingSettings = {
  originPostalCode: string;
  fixedShippingCents: number | null;
  freeShippingThresholdCents: number | null;
  regionalShippingEnabled: boolean;
  curitibaMetroShippingCents: number;
  interiorParanaShippingCents: number;
  otherStatesShippingCents: number;
  fixedShippingEnabled: boolean;
  freeShippingEnabled: boolean;
  correiosShippingEnabled: boolean;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  orderDeliveryColumnsAvailable: boolean;
  settingsTableAvailable: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
};

function isSettingsTableMissing(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && ["P2021", "P2022"].includes(String((error as { code?: unknown }).code)));
}

function environmentFixedShipping() {
  if (!hasConfiguredShippingRate()) return null;
  try { return getConfiguredShippingCents(); }
  catch { return null; }
}

export async function getStoreShippingSettings(): Promise<StoreShippingSettings> {
  const configuredFixedRate = environmentFixedShipping();
  let orderDeliveryColumnsAvailable = false;
  if (process.env.DATABASE_URL) {
    try {
      const columns = await getDb().$queryRaw<Array<{ available: boolean }>>`
        SELECT COUNT(*) = 2 AS available
        FROM pg_attribute
        WHERE attrelid = to_regclass('public.orders')
          AND attname IN ('shippingDeliveryMinDays', 'shippingDeliveryMaxDays')
          AND NOT attisdropped
      `;
      orderDeliveryColumnsAvailable = columns[0]?.available === true;
    } catch {
      // Delivery estimates are optional; a metadata lookup failure must not block checkout.
    }
  }
  const fallback = {
    originPostalCode: getCorreiosSetupStatus().origin,
    fixedShippingCents: configuredFixedRate,
    freeShippingThresholdCents: null,
    // The store's published regional table is the safe fallback while the
    // optional admin-settings migration is unavailable: R$10 / R$20 / R$30.
    regionalShippingEnabled: true,
    curitibaMetroShippingCents: 1_000,
    interiorParanaShippingCents: 2_000,
    otherStatesShippingCents: 3_000,
    fixedShippingEnabled: configuredFixedRate !== null,
    freeShippingEnabled: false,
    correiosShippingEnabled: hasCorreiosSettings(),
    estimatedMinDays: null,
    estimatedMaxDays: null,
    orderDeliveryColumnsAvailable,
    settingsTableAvailable: false,
    updatedBy: null,
    updatedAt: null,
  };
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const stored = await getDb().shippingSettings.findUnique({ where: { id: "store" } });
    if (!stored) return {
      ...fallback,
      regionalShippingEnabled: true,
      settingsTableAvailable: true,
    };
    return {
      originPostalCode: /^\d{8}$/.test(stored.originPostalCode ?? "") ? stored.originPostalCode! : fallback.originPostalCode,
      fixedShippingCents: stored.fixedShippingCents,
      freeShippingThresholdCents: stored.freeShippingThresholdCents,
      regionalShippingEnabled: stored.regionalShippingEnabled,
      curitibaMetroShippingCents: stored.curitibaMetroShippingCents,
      interiorParanaShippingCents: stored.interiorParanaShippingCents,
      otherStatesShippingCents: stored.otherStatesShippingCents,
      fixedShippingEnabled: stored.fixedShippingEnabled,
      freeShippingEnabled: stored.freeShippingEnabled,
      correiosShippingEnabled: stored.correiosShippingEnabled,
      estimatedMinDays: stored.estimatedMinDays,
      estimatedMaxDays: stored.estimatedMaxDays,
      orderDeliveryColumnsAvailable,
      settingsTableAvailable: true,
      updatedBy: stored.updatedBy,
      updatedAt: stored.updatedAt,
    };
  } catch (error) {
    if (isSettingsTableMissing(error)) return fallback;
    throw error;
  }
}

