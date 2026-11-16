export function paymentReservationDurationMinutes(configuredRaw: string | undefined) {
  const minimum = 5;
  const fallback = 20;
  const configured = Number(configuredRaw || fallback);
  return Number.isInteger(configured) && configured >= minimum && configured <= 120 ? configured : fallback;
}
