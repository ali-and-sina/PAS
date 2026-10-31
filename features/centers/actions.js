"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect } from "@/lib/auth/redirects";
import { CENTER_TYPES } from "@/lib/centers/config";
import { normalizeDigits, normalizeIranianMobile, isValidIranianMobile, isValidLicenseIdentifier } from "@/lib/utils/validation";

const centerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  display_name: z.string().trim().min(2).max(160),
  phone: z.string().refine(isValidIranianMobile),
  license_number: z.string().trim().max(100).refine(isValidLicenseIdentifier),
  center_type: z.enum(Object.keys(CENTER_TYPES)),
  password: z.string().min(12).max(128),
});
export async function createMedicalCenter(previous, formData) {
  const admin = await requireAdmin();
  const source = formData?.get ? formData : previous?.get ? previous : null;
  const values = Object.fromEntries(Object.keys(centerSchema.shape).map((key) => [key, source ? source.get(key) : previous?.[key]]));
  if (typeof values.phone === "string") values.phone = normalizeDigits(values.phone);
  const parsed = centerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "اطلاعات مرکز، شمارهٔ همراه و رمز حداقل ۱۲ نویسه‌ای را بررسی کنید." };
  const input = parsed.data;
  const db = createAdminClient();
  let authId;
  try {
    const { data, error } = await db.auth.admin.createUser({
      phone: normalizeIranianMobile(input.phone), phone_confirm: true,
      password: input.password, user_metadata: { full_name: input.full_name },
    });
    if (error || !data?.user) throw error || new Error("Auth account not created");
    authId = data.user.id;
    const provision = await db.rpc("pas_provision_center", { p_profile: authId, p_actor: admin.id, p_type: input.center_type, p_name: input.display_name, p_license: input.license_number });
    if (provision.error) throw provision.error;
  } catch (error) {
    if (authId) {
      const rollback = await db.auth.admin.deleteUser(authId);
      if (rollback.error) console.error("[center provisioning rollback]", { code: rollback.error.code });
    }
    console.error("[center provisioning]", { code: error?.code });
    return { ok: false, message: ["23505", "phone_exists", "user_already_exists"].includes(error?.code) ? "شمارهٔ همراه یا مجوز مرکز قبلاً ثبت شده است." : "ساخت حساب مرکز کامل نشد؛ دوباره بررسی کنید." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "حساب مرکز و دسترسی پنل اختصاصی ایجاد شد.", redirectTo: "/admin/centers" };
}

export async function loginMedicalCenter(input) {
  const invalid = { ok: false, code: "INVALID_INPUT", message: "نام کاربری یا رمز عبور درست نیست یا حساب مرکز فعال نیست." };
  if (!input || typeof input !== "object" || typeof input.phone !== "string" || typeof input.password !== "string" || input.password.length < 1 || input.password.length > 128 || !isValidIranianMobile(normalizeDigits(input.phone))) return invalid;
  const db = await createClient();
  try {
    const result = await db.auth.signInWithPassword({ phone: normalizeIranianMobile(normalizeDigits(input.phone)), password: input.password });
    if (result.error || !result.data?.user) return invalid;
    const user = await getSessionUser();
    if (user?.id !== result.data.user.id || !["laboratory", "medical_center"].includes(user.role) || !CENTER_TYPES[user.center_type] || user.center_active !== true) {
      await db.auth.signOut({ scope: "local" }); return invalid;
    }
    return { ok: true, redirectTo: getPostLoginRedirect(user) };
  } catch {
    await db.auth.signOut({ scope: "local" }).catch(()=>{});
    return { ok: false, code: "SERVER_ERROR", message: "ورود انجام نشد؛ دوباره تلاش کنید." };
  }
}
