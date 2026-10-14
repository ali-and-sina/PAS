"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RAW_TOKEN_RE = /^[0-9a-f]{64}$/;

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createRawToken() {
  return randomBytes(32).toString("hex");
}

async function issueToken({ targetType, dispatchId = null, homeCollectionRequestId = null }) {
  const supabase = await createClient();
  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: tokenId, error } = await supabase.rpc("create_lab_workflow_qr_token", {
    p_target_type: targetType,
    p_dispatch_id: dispatchId,
    p_home_collection_request_id: homeCollectionRequestId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error("[issueLabWorkflowQrToken]", error);
    return { ok: false, message: "ساخت کد پذیرش انجام نشد؛ وضعیت درخواست را بررسی کنید." };
  }

  return {
    ok: true,
    token,
    expiresAt,
    // Use a URL fragment so the raw token is not sent in HTTP requests or access logs.
    // The scanner page will read the fragment client-side and submit it to a server action.
    path: `/lab/intake/scan#token=${encodeURIComponent(token)}`,
  };
}

export async function createPatientDispatchQrToken(dispatchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient" || !isUuid(dispatchId)) {
    return { ok: false, message: "ساخت کد پذیرش مجاز نیست." };
  }

  const supabase = await createClient();
  const { data: dispatch, error } = await supabase
    .from("lab_dispatches")
    .select("id, created_by, status, lab_order_id")
    .eq("id", dispatchId)
    .maybeSingle();

  if (error) throw error;
  if (!dispatch || dispatch.created_by !== user.id || !["pending", "accepted"].includes(dispatch.status)) {
    return { ok: false, message: "فقط برای درخواست ارسال‌شده و فعال می‌توان کد پذیرش ساخت." };
  }
  if (dispatch.status === "accepted" && !dispatch.lab_order_id) {
    return { ok: false, message: "ثبت پذیرش آزمایش هنوز کامل نشده است." };
  }

  const result = await issueToken({ targetType: "dispatch", dispatchId });
  if (result.ok) revalidatePath("/patient/lab-orders");
  return result;
}

export async function createHomeCollectionQrToken(homeCollectionRequestId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(homeCollectionRequestId)) {
    return { ok: false, message: "ساخت کد نمونه‌گیری مجاز نیست." };
  }

  const result = await issueToken({ targetType: "home_collection", homeCollectionRequestId });
  if (result.ok) revalidatePath("/lab/home-collection");
  return result;
}

export async function resolveLabWorkflowQrToken(rawToken) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory") return { ok: false, message: "برای اسکن درخواست باید وارد پنل آزمایشگاه شوید." };
  const token = String(rawToken || "").trim();
  if (!RAW_TOKEN_RE.test(token)) return { ok: false, message: "کد پذیرش معتبر نیست." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_lab_workflow_qr_token", {
    p_token_hash: hashToken(token),
  });

  if (error) {
    console.error("[resolveLabWorkflowQrToken]", error);
    return { ok: false, message: "این کد نامعتبر، منقضی‌شده یا متعلق به شعبه دیگری است." };
  }

  return { ok: true, data };
}

export async function collectHomeSampleFromQr({ homeCollectionRequestId, token } = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(homeCollectionRequestId)) {
    return { ok: false, message: "ثبت دریافت نمونه مجاز نیست." };
  }
  const rawToken = String(token || "").trim();
  if (!RAW_TOKEN_RE.test(rawToken)) return { ok: false, message: "کد نمونه‌گیری معتبر نیست." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("collect_home_sample_from_qr", {
    p_home_collection_request_id: homeCollectionRequestId,
    p_token_hash: hashToken(rawToken),
  });
  if (error) {
    console.error("[collectHomeSampleFromQr]", error);
    return { ok: false, message: "ثبت دریافت نمونه انجام نشد. وضعیت اعزام و تعلق درخواست به شعبه را بررسی کنید." };
  }

  revalidatePath("/lab/home-collection");
  revalidatePath("/lab/orders");
  revalidatePath("/patient/lab-orders");
  return { ok: true, data };
}

export async function revokeLabWorkflowQrToken({ dispatchId = null, homeCollectionRequestId = null } = {}) {
  const user = await getSessionUser();
  if (!user?.id || !["patient", "doctor", "laboratory"].includes(user.role)) {
    return { ok: false, message: "لغو کد پذیرش مجاز نیست." };
  }
  if ((dispatchId === null) === (homeCollectionRequestId === null)
    || (dispatchId !== null && !isUuid(dispatchId))
    || (homeCollectionRequestId !== null && !isUuid(homeCollectionRequestId))) {
    return { ok: false, message: "درخواست لغو کد پذیرش معتبر نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_lab_workflow_qr_tokens", {
    p_dispatch_id: dispatchId,
    p_home_collection_request_id: homeCollectionRequestId,
  });
  if (error) {
    console.error("[revokeLabWorkflowQrToken]", error);
    return { ok: false, message: "لغو کد پذیرش انجام نشد." };
  }
  revalidatePath("/patient/lab-orders");
  revalidatePath("/lab/home-collection");
  return { ok: true, revokedCount: data };
}
