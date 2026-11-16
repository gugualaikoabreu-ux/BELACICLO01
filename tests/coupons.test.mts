import assert from "node:assert/strict";
import test from "node:test";
import { calculateCouponDiscountCents, getCouponValidationError, normalizeCouponCode } from "../lib/coupons.ts";

const now = new Date("2026-11-14T12:00:00.000Z");
const activeCoupon = {
  active: true,
  startsAt: new Date("2026-11-01T00:00:00.000Z"),
  endsAt: new Date("2026-12-01T00:00:00.000Z"),
  discountBps: 1500,
  discountCents: null,
  minimumSubtotalCents: 10_000,
  usageLimit: 3,
  usedCount: 0,
};

test("coupon codes are normalized before lookup", () => {
  assert.equal(normalizeCouponCode("  verao-26 "), "VERAO-26");
});

test("percentage coupon discounts use integer cents and never exceed subtotal", () => {
  assert.equal(calculateCouponDiscountCents(activeCoupon, 12_345), 1_851);
  assert.equal(calculateCouponDiscountCents({ discountBps: null, discountCents: 20_000 }, 12_345), 12_345);
});

test("coupon validation checks status, schedule, minimum, and usage cap", () => {
  assert.equal(getCouponValidationError(activeCoupon, 10_000, now), null);
  assert.match(getCouponValidationError({ ...activeCoupon, active: false }, 10_000, now) ?? "", /não está ativo/);
  assert.match(getCouponValidationError({ ...activeCoupon, startsAt: new Date("2026-11-15T00:00:00.000Z") }, 10_000, now) ?? "", /ainda não começou/);
  assert.match(getCouponValidationError({ ...activeCoupon, endsAt: now }, 10_000, now) ?? "", /expirou/);
  assert.match(getCouponValidationError(activeCoupon, 9_999, now) ?? "", /mínimo/);
  assert.match(getCouponValidationError({ ...activeCoupon, usedCount: 3 }, 10_000, now) ?? "", /limite/);
});
