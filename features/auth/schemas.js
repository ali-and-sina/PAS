import { z } from "zod";
import {
  cleanIdentifier,
  isValidIranianMobile,
  normalizeIranianMobile,
} from "@/lib/utils/validation";
import { LOGIN_ROLE_CONFIG, OTP_LENGTH, PHONE_MESSAGES } from "./config";

/**
 * Identity step schema for a given role.
 *
 * Output:
 * {
 *   identifier: "...",
 *   phone: "989121234567"
 * }
 *
 * Phone is intentionally kept without the leading "+".
 */
export function buildLoginIdentitySchema(role) {
  const roleConfig = LOGIN_ROLE_CONFIG[role];

  if (!roleConfig) {
    throw new Error(`Unknown login role: ${role}`);
  }

  const { identifier } = roleConfig;

  return z.object({
    identifier: z
      .string()
      .min(1, { message: identifier.requiredMessage })
      .refine((v) => identifier.validate(v), {
        message: identifier.invalidMessage,
      })
      .transform(cleanIdentifier),

    phone: z
      .string()
      .min(1, { message: PHONE_MESSAGES.required })
      .refine(isValidIranianMobile, {
        message: PHONE_MESSAGES.invalid,
      })
      .transform((value) => {
        const normalized = normalizeIranianMobile(value);

        return normalized ? normalized.replace(/^\+/, "") : "";
      }),
  });
}

export const otpCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
    message: "کد تأیید را کامل وارد کنید.",
  });
