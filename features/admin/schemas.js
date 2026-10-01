import { z } from "zod";
import {
  cleanIdentifier,
  isValidFullName,
  isValidIranianMobile,
  isValidLicenseIdentifier,
  normalizeFullName,
  normalizeIranianMobile,
} from "@/lib/utils/validation";

// specialty / organization_type are plain text until Backend confirms a fixed list.

export const doctorSchema = z.object({
  full_name: z
    .string()
    .min(1, { message: "نام و نام خانوادگی را وارد کنید." })
    .refine(isValidFullName, {
      message: "نام و نام خانوادگی را کامل و بدون عدد وارد کنید.",
    })
    .transform(normalizeFullName),
  phone: z
    .string()
    .min(1, { message: "شماره موبایل را وارد کنید." })
    .refine(isValidIranianMobile, { message: "شماره موبایل معتبر نیست." })
    .transform(normalizeIranianMobile),
  medical_license_number: z
    .string()
    .min(1, { message: "شماره نظام پزشکی را وارد کنید." })
    .refine(isValidLicenseIdentifier, {
      message: "شماره نظام پزشکی معتبر نیست.",
    })
    .transform(cleanIdentifier),
  specialty: z
    .string()
    .min(1, { message: "تخصص را وارد کنید." })
    .max(80, { message: "تخصص را کوتاه‌تر وارد کنید." })
    .transform((v) => v.trim()),
});

export const createAdminSchema = z.object({
  full_name: z
    .string()
    .min(1, { message: "نام و نام خانوادگی را وارد کنید." })
    .refine(isValidFullName, {
      message: "نام و نام خانوادگی را کامل و بدون عدد وارد کنید.",
    })
    .transform(normalizeFullName),
  phone: z
    .string()
    .min(1, { message: "شماره موبایل را وارد کنید." })
    .refine(isValidIranianMobile, { message: "شماره موبایل معتبر نیست." })
    .transform(normalizeIranianMobile),
  personnel_code: z
    .string()
    .min(1, { message: "کد پرسنلی را وارد کنید." })
    .max(100, { message: "کد پرسنلی را کوتاه‌تر وارد کنید." })
    .transform(cleanIdentifier),
});

export const laboratorySchema = z.object({
  organization_name: z
    .string()
    .min(1, { message: "نام آزمایشگاه را وارد کنید." })
    .max(120, { message: "نام آزمایشگاه را کوتاه‌تر وارد کنید." })
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, { message: "شماره موبایل را وارد کنید." })
    .refine(isValidIranianMobile, { message: "شماره موبایل معتبر نیست." })
    .transform(normalizeIranianMobile),
  license_number: z
    .string()
    .min(1, { message: "شماره مجوز را وارد کنید." })
    .refine(isValidLicenseIdentifier, { message: "شماره مجوز معتبر نیست." })
    .transform(cleanIdentifier),
  organization_type: z
    .string()
    .min(1, { message: "نوع سازمان را وارد کنید." })
    .max(60, { message: "نوع سازمان را کوتاه‌تر وارد کنید." })
    .transform((v) => v.trim()),
});

// Action-facing aliases keep the server actions explicit while the forms
// continue using the shorter schema names above.
export const createDoctorSchema = doctorSchema;
export const createLaboratorySchema = laboratorySchema;
