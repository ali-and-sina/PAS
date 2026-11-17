const DAY = 86400000;
export function medicationCoverage(item, receipts = [], now = Date.now()) {
  const valid = receipts.filter((r) => r.prescription_item_id === item.id)
    .map((r) => ({ ...r, time: Date.parse(r.received_at), quantity: Number(r.quantity_units) }))
    .filter((r) => Number.isFinite(r.time) && r.time <= now && Number.isFinite(r.quantity) && r.quantity > 0)
    .sort((a, b) => a.time - b.time);
  if (!valid.length) return { status: "not_received", label: "دریافت نشده", endAt: null, received: 0 };
  const received = valid.reduce((n, r) => n + r.quantity, 0);
  const daily = Number(item.units_per_day);
  if (item.as_needed || !Number.isFinite(daily) || daily <= 0) {
    return { status: "unknown", label: "دریافت شده؛ پایان نامشخص", endAt: null, received };
  }
  let end = 0;
  for (const r of valid) end = Math.max(end, r.time) + r.quantity / daily * DAY;
  return {
    status: end > now ? "active" : "inactive",
    label: end > now ? "فعال" : "پایان دورهٔ برآوردی",
    endAt: new Date(end).toISOString(), received,
  };
}
export function prescriptionCoverage(prescription, items, receipts, now = Date.now()) {
  if (prescription.status !== "active") return { status: "inactive", label: "غیرفعال" };
  const states = items.map((item) => medicationCoverage(item, receipts, now).status);
  if (!states.length || states.every((s) => s === "not_received")) return { status: "not_received", label: "دریافت نشده" };
  if (states.includes("not_received")) return { status: "partial", label: "دریافت ناقص" };
  if (states.includes("active")) return { status: "active", label: "فعال" };
  if (states.includes("unknown")) return { status: "unknown", label: "زمان پایان نامشخص" };
  return { status: "inactive", label: "پایان دورهٔ برآوردی" };
}
export const MEDICATION_COLORS = {
  active: "border-status-normal-border bg-status-normal-bg text-status-normal",
  inactive: "border-status-critical-border bg-status-critical-bg text-status-critical",
  not_received: "border-status-low-border bg-status-low-bg text-status-low",
  partial: "border-status-low-border bg-status-low-bg text-status-low",
  unknown: "border-status-superseded-border bg-status-superseded-bg text-status-superseded",
};
