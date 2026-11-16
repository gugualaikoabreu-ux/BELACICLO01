import assert from "node:assert/strict";
import test from "node:test";
import { paymentReservationDurationMinutes } from "../lib/payments/reservation-duration.ts";

test("manual PIX reservation duration uses a bounded 20 minute default", () => {
  assert.equal(paymentReservationDurationMinutes(undefined), 20);
  assert.equal(paymentReservationDurationMinutes("10"), 10);
  assert.equal(paymentReservationDurationMinutes("200"), 20);
  assert.equal(paymentReservationDurationMinutes("3"), 20);
});
