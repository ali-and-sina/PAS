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
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  inactive: "border-red-200 bg-red-50 text-red-800",
  not_received: "border-orange-200 bg-orange-50 text-orange-800",
  partial: "border-orange-200 bg-orange-50 text-orange-800",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};
