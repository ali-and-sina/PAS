/**
 * Single Source of Truth وضعیت‌های Business.
 * مقادیر string دقیقاً همان مقادیر Backend هستند.
 */

export const LAB_ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  RECEIVED: "received_by_lab",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const REPORT_STATUS = Object.freeze({
  DRAFT: "draft",
  FINAL: "final",
  AMENDED: "amended",
});

export const OBSERVATION_STATUS = Object.freeze({
  PRELIMINARY: "preliminary",
  FINAL: "final",
  CORRECTED: "corrected",
  SUPERSEDED: "superseded",
});

export const RESULT_FLAG = Object.freeze({
  NORMAL: "normal",
  LOW: "low",
  HIGH: "high",
  CRITICAL_LOW: "critical_low",
  CRITICAL_HIGH: "critical_high",
});

export const VISIT_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
});

export const RELATIONSHIP_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const STATUS_FA = Object.freeze({
  pending: "در انتظار",
  received_by_lab: "دریافت در آزمایشگاه",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  draft: "پیش‌نویس",
  final: "نهایی",
  amended: "اصلاح‌شده",
  preliminary: "اولیه",
  corrected: "تصحیح‌شده",
  superseded: "منسوخ‌شده",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  active: "فعال",
  inactive: "غیرفعال",
  normal: "طبیعی",
  low: "پایین‌تر از حد",
  high: "بالاتر از حد",
  critical_low: "بحرانی (پایین)",
  critical_high: "بحرانی (بالا)",
});

const STATUS_TONE = Object.freeze({
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",

  pending: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  preliminary: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-border bg-muted text-muted-foreground",

  high: "border-orange-200 bg-orange-50 text-orange-700",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",

  critical_low: "border-red-200 bg-red-50 text-red-700",
  critical_high: "border-red-200 bg-red-50 text-red-700",

  corrected: "border-violet-200 bg-violet-50 text-violet-700",
  amended: "border-violet-200 bg-violet-50 text-violet-700",

  superseded: "border-border bg-muted text-muted-foreground line-through",
  rejected: "border-border bg-muted text-muted-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
  inactive: "border-border bg-muted text-muted-foreground",
});

const DEFAULT_TONE = "border-border bg-muted text-muted-foreground";

export function getStatusLabel(status) {
  return STATUS_FA[status] ?? "وضعیت نامشخص";
}

export function getSexLabel(sex) {
  if (sex === "male") return "مرد";
  if (sex === "female") return "زن";
  return "نامشخص";
}

export function getOrganizationTypeLabel(type) {
  if (type === "laboratory") return "آزمایشگاه";
  if (type === "clinic") return "درمانگاه";
  if (type === "hospital") return "بیمارستان";
  if (type === "organization") return "سازمان";
  return "نوع سازمان نامشخص";
}

export function getStatusTone(status) {
  return STATUS_TONE[status] ?? DEFAULT_TONE;
}
