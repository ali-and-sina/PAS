import {
  isValidIranianNationalId,
  isValidLicenseIdentifier,
} from "@/lib/utils/validation";

/**
 * OTP timing shown in the UI.
 * These MUST match the Supabase dashboard.
 */
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 120;
export const OTP_RESEND_SECONDS = 60;

export const LOGIN_ROLE_CONFIG = {
  patient: {
    role: "patient",
    label: "بیمار",
    description: "نتایج آزمایش، تفسیر پزشک و نسخه‌های من",
    identifier: {
      label: "کد ملی",
      placeholder: "0123456789",
      inputMode: "numeric",
      requiredMessage: "کد ملی را وارد کنید.",
      invalidMessage: "کد ملی معتبر نیست.",
      validate: isValidIranianNationalId,
    },
  },

  doctor: {
    role: "doctor",
    label: "پزشک",
    description: "بیماران، آزمایش‌ها و تفسیر نتایج",
    identifier: {
      label: "شماره نظام پزشکی",
      placeholder: "12345",
      inputMode: "numeric",
      requiredMessage: "شماره نظام پزشکی را وارد کنید.",
      invalidMessage: "شماره نظام پزشکی معتبر نیست.",
      validate: isValidLicenseIdentifier,
    },
  },

  laboratory: {
    role: "laboratory",
    label: "مرکز درمانی",
    description: "ورود به پنل اختصاصی مرکز با حساب تعریف‌شده توسط مدیر",
    identifier: {
      label: "شناسه آزمایشگاه",
      placeholder: "LAB-1234",
      inputMode: "text",
      requiredMessage: "شناسه آزمایشگاه را وارد کنید.",
      invalidMessage: "شناسه آزمایشگاه معتبر نیست.",
      validate: isValidLicenseIdentifier,
    },
  },

  admin: {
    role: "admin",
    label: "مدیر سیستم",
    description: "مدیریت کاربران و تنظیمات سامانه",
    identifier: {
      label: "کد پرسنلی",
      placeholder: "ADM-0001",
      inputMode: "text",
      requiredMessage: "کد پرسنلی را وارد کنید.",
      invalidMessage: "کد پرسنلی معتبر نیست.",
      validate: isValidLicenseIdentifier,
    },
  },
};

/**
 * Display order on the role picker.
 */
export const LOGIN_ROLES = [
  LOGIN_ROLE_CONFIG.patient,
  LOGIN_ROLE_CONFIG.doctor,
  LOGIN_ROLE_CONFIG.laboratory,
];

export const PHONE_MESSAGES = {
  required: "شماره موبایل را وارد کنید.",
  invalid: "شماره موبایل معتبر نیست.",
};

/**
 * Server error code → user-facing message.
 *
 * USER_NOT_FOUND intentionally uses the same generic message
 * so the UI does not reveal whether an account exists.
 */
const AUTH_ERROR_MESSAGES = {
  INVALID_INPUT:
    "مشخصات واردشده معتبر نیست. اطلاعات را بررسی و دوباره تلاش کنید.",

  USER_NOT_FOUND:
    "مشخصات واردشده معتبر نیست. اطلاعات را بررسی و دوباره تلاش کنید.",

  WRONG_OTP: "کد واردشده صحیح نیست.",

  EXPIRED_OTP: "کد منقضی شده است. کد جدید دریافت کنید.",

  NOT_VERIFIED: "دسترسی شما برای این بخش تأیید نشده است.",

  RATE_LIMITED: "تعداد تلاش‌ها زیاد بود. کمی بعد دوباره تلاش کنید.",

  SERVER_ERROR: "ورود با مشکل مواجه شد. لطفاً دوباره تلاش کنید.",
};

export function getAuthErrorMessage(code) {
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.SERVER_ERROR;
}
