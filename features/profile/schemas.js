import { z } from "zod";
import { isValidFullName, normalizeFullName } from "@/lib/utils/validation";

export const profileNameSchema = z.object({
  full_name: z
    .string()
    .min(1, { message: "نام و نام خانوادگی را وارد کنید." })
    .refine(isValidFullName, {
      message: "نام و نام خانوادگی را کامل و بدون عدد وارد کنید.",
    })
    .transform(normalizeFullName),
});
