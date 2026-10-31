export const RECORD_SCOPES = [
  ["labs", "آزمایش‌ها و نتایج"],
  ["medications", "نسخه‌ها و داروهای دریافتی"],
  ["visits", "ویزیت‌ها و خلاصهٔ ویزیت"],
  ["follow_ups", "پیگیری‌های درمان"],
  ["diagnostics", "تصویربرداری و خدمات تشخیصی"],
];
export const SERVICE_KINDS = [
  ["ct", "سی‌تی‌اسکن"], ["mri", "ام‌آر‌آی"], ["ecg", "نوار قلب"],
  ["ultrasound", "سونوگرافی"], ["mammography", "ماموگرافی"],
  ["xray", "رادیوگرافی"], ["physiotherapy", "فیزیوتراپی"], ["other", "سایر خدمات پزشکی"],
];
export const CONSULTATION_STATUS = {
  requested: "در انتظار پذیرش پزشک", accepted: "ویزیت در حال انجام",
  completed: "ویزیت مختومه", declined: "پذیرفته نشد", cancelled: "لغوشده",
};
export const MEDICAL_STATUS = {
  requested: "در انتظار پذیرش", accepted: "پذیرش‌شده", in_progress: "در حال انجام",
  reported: "گزارش آماده", cancelled: "لغوشده",
};
export const PHARMACY_STATUS = {
  submitted: "درخواست ثبت شد", reviewing: "در حال هماهنگی داروخانه",
  preparing: "در حال آماده‌سازی", dispatched: "تحویل به پیک",
  delivered: "تحویل داده شد", cancelled: "لغوشده", rejected: "تأمین نشد",
};
export const ACCOUNT_PATHS = {
  patient: "/patient/settings", doctor: "/doctor/settings", laboratory: "/lab/settings", admin: "/admin/settings",
};
export const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
