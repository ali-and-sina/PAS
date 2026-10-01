import { z } from "zod";
import { isValidFullName, normalizeFullName } from "@/lib/utils/validation";

function isRealCalendarDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date <= now
  );
}

export const patientProfileCompletionSchema = z.object({
  full_name: z
    .string()
    .min(1, {
      message: "نام و نام خانوادگی را وارد کنید.",
    })
    .refine(isValidFullName, {
      message: "نام و نام خانوادگی را کامل و بدون عدد وارد کنید.",
    })
    .transform(normalizeFullName),

  date_of_birth: z.string().refine(isRealCalendarDate, {
    message: "تاریخ تولد معتبر نیست.",
  }),

  sex: z.enum(["male", "female"], {
    errorMap: () => ({
      message: "جنسیت را انتخاب کنید.",
    }),
  }),
});

export const profileNameSchema = patientProfileCompletionSchema;
