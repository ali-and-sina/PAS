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
  received_by_lab: "پذیرفته‌شده توسط آزمایشگاه",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  draft: "پیش‌نویس",
  final: "نهایی",
  amended: "اصلاح‌شده",
  preliminary: "نتیجه اولیه",
  corrected: "اصلاح‌شده",
  superseded: "جایگزین‌شده",
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

// Tones read the status tokens from globals.css so semantic colors stay
// aligned with the brand palette instead of parallel Tailwind greens/ambers.
const STATUS_TONE = Object.freeze({
  normal: "border-status-normal-border bg-status-normal-bg text-status-normal",
  final: "border-status-normal-border bg-status-normal-bg text-status-normal",
  completed: "border-status-normal-border bg-status-normal-bg text-status-normal",
  accepted: "border-status-normal-border bg-status-normal-bg text-status-normal",
  active: "border-status-normal-border bg-status-normal-bg text-status-normal",

  pending: "border-status-low-border bg-status-low-bg text-status-low",
  low: "border-status-low-border bg-status-low-bg text-status-low",
  preliminary: "border-status-low-border bg-status-low-bg text-status-low",
  draft: "border-border bg-muted text-muted-foreground",

  high: "border-status-high-border bg-status-high-bg text-status-high",
  in_progress: "border-status-low-border bg-status-low-bg text-status-low",

  critical_low: "border-status-critical-border bg-status-critical-bg text-status-critical",
  critical_high: "border-status-critical-border bg-status-critical-bg text-status-critical",

  corrected: "border-status-superseded-border bg-status-superseded-bg text-status-superseded",
  amended: "border-status-superseded-border bg-status-superseded-bg text-status-superseded",

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
