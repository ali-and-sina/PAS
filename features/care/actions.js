"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { readCalendarEvents } from "./queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMANDS = new Set([
  "profile.update", "identity.request", "access.set", "availability.set",
  "consultation.request", "consultation.accept", "consultation.cancel", "consultation.message",
  "visit.close", "center.status", "medical.session", "medical.schedule", "medical.request", "medical.assign", "medical.advance",
  "medical.finish", "medication.received", "pharmacy.request", "pharmacy.cancel",
  "pharmacy.advance", "integration.configure",
]);
const invalid = () => ({ ok: false, message: "اطلاعات واردشده معتبر نیست." });

function refreshCarePages() {
  for (const path of ["/patient", "/doctor", "/lab", "/center", "/admin"]) revalidatePath(path, "layout");
}

export async function runCareCommand(action, payload) {
  if (!COMMANDS.has(action) || !payload || typeof payload !== "object" ||
      Array.isArray(payload) || JSON.stringify(payload).length > 32768) return invalid();
  const user = await getSessionUser();
  if (!user?.id) return { ok: false, message: "برای ادامه وارد حساب شوید." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pas_care_command", {
      p_action: action, p_payload: payload,
    });
    if (error) {
      console.error("[care command]", { action, code: error.code });
      return {
        ok: false,
        message: error.code === "23505"
          ? "یک درخواست مشابه از قبل ثبت شده است؛ فهرست را تازه‌سازی کنید."
          : error.code === "42501"
            ? "اجازهٔ انجام این کار وجود ندارد؛ مجوزهای پرونده را بررسی کنید."
            : "ثبت انجام نشد؛ اطلاعات، وضعیت درخواست و دسترسی‌ها را بررسی کنید.",
      };
    }
    refreshCarePages();
    return { ok: true, message: "با موفقیت ثبت شد.", data };
  } catch {
    return { ok: false, message: "ارتباط با سامانه برقرار نشد. دوباره تلاش کنید." };
  }
}

export async function loadCalendarEvents({ patientId, from, to } = {}) {
  try {
    return { ok: true, events: await readCalendarEvents(patientId, from, to) };
  } catch {
    return { ok: false, message: "رویدادهای این ماه دریافت نشد." };
  }
}

export async function getCareMessages(consultationId, before = null) {
  if (!UUID.test(String(consultationId))) return invalid();
  const user = await getSessionUser();
  if (!user?.id) return invalid();
  const supabase = await createClient();
  const { data: consultation, error: requestError } = await supabase
    .from("pas_consultations").select("id,status").eq("id", consultationId).maybeSingle();
  if (requestError || !consultation) return { ok: false, message: "دسترسی گفت‌وگو برقرار نیست." };
  let query = supabase.from("pas_consultation_messages")
    .select("id,sender_id,body,audio_path,created_at")
    .eq("consultation_id", consultationId).order("created_at", { ascending: false }).order("id",{ascending:false}).limit(100);
  if(before){
    const date=Date.parse(before.created_at);
    if(!Number.isFinite(date)||!UUID.test(String(before.id)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(String(before.created_at))) return invalid();
    const iso=String(before.created_at);
    query=query.or("created_at.lt."+iso+",and(created_at.eq."+iso+",id.lt."+before.id+")");
  }
  const {data,error}=await query;
  if (error) return { ok: false, message: "پیام‌ها دریافت نشدند." };
  const messages = await Promise.all((data || []).reverse().map(async (message) => {
    if (!message.audio_path) return message;
    return { ...message, audio_url: "/api/care/files?bucket=pas-consultations&path=" + encodeURIComponent(message.audio_path) };
  }));
  return { ok: true, messages, status: consultation.status, hasMore: data.length === 100 };
}

export async function createCareUpload({ kind, resourceId, messageId, mimeType, fileSize } = {}) {
  if (!UUID.test(String(resourceId)) || !Number.isInteger(fileSize) || fileSize < 1) return invalid();
  const user = await getSessionUser();
  if (!user?.id) return invalid();
  const supabase = await createClient();
  let bucket;
  let extension;
  let fileId;
  if (kind === "consultation-audio") {
    const types = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3" };
    extension = types[mimeType];
    if (!extension || fileSize > 2097152 || !UUID.test(String(messageId))) return invalid();
    const { data } = await supabase.from("pas_consultations").select("id,status")
      .eq("id", resourceId).eq("status", "accepted").maybeSingle();
    if (!data) return { ok: false, message: "ویزیت فعال و مجاز لازم است." };
    bucket = "pas-consultations";
    fileId = messageId;
  } else if (kind === "medical-document") {
    const types = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
    extension = types[mimeType];
    if (!extension || fileSize > 20971520 || user.role !== "medical_center") return invalid();
    const { data } = await supabase.from("pas_medical_requests").select("id")
      .eq("id", resourceId).eq("provider_id", user.id)
      .in("status", ["accepted", "in_progress", "reported"]).maybeSingle();
    if (!data) return { ok: false, message: "اجازهٔ بارگذاری برای این پذیرش وجود ندارد." };
    bucket = "pas-medical-documents";
    fileId = randomUUID();
  } else return invalid();
  const path = resourceId + "/" + user.id + "/" + fileId + "." + extension;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.token) return { ok: false, message: "آماده‌سازی بارگذاری انجام نشد." };
  return { ok: true, bucket, path, token: data.token };
}

export async function reviewIdentityRequest({ id, decision, note = "" } = {}) {
  if (!UUID.test(String(id)) || !["approve", "reject"].includes(decision)) return invalid();
  try {
    const admin = await requireAdmin();
    const user = admin?.user || admin;
    const supabase = await createClient();
    const { data: request, error } = await supabase.rpc("pas_care_command", {
      p_action: "identity.review", p_payload: { id, decision, note },
    });
    if (error || !request) return { ok: false, message: "این درخواست قابل بررسی نیست." };
    if (decision === "reject") {
      refreshCarePages();
      return { ok: true, message: "درخواست رد شد." };
    }
    const privileged = createAdminClient();
    if (request.requested_phone) {
      // Idempotent recovery: a previous attempt may have updated Auth already.
      const { data: current, error: readError } = await privileged.auth.admin.getUserById(request.profile_id);
      if (readError) return { ok: false, message: "احراز هویت خوانده نشد؛ ادامهٔ بررسی را دوباره بزنید." };
      if (String(current.user.phone || "").replace(/^\+/, "") !== request.requested_phone ||
          !current.user.phone_confirmed_at) {
        const { error: authError } = await privileged.auth.admin.updateUserById(request.profile_id, {
          phone: "+" + request.requested_phone, phone_confirm: true,
        });
        if (authError) {
          await privileged.from("pas_identity_requests").update({ status: "pending" }).eq("id", id);
          return { ok: false, message: "شماره در سامانهٔ ورود تغییر نکرد؛ تکراری‌نبودن و تأیید مالکیت را بررسی کنید." };
        }
      }
    }
    const { error: commitError } = await privileged.rpc("pas_finish_identity_request", {
      p_request_id: id, p_reviewer_id: user.id,
    });
    if (commitError) return { ok: false, message: "بررسی در حال انجام است؛ با «ادامهٔ بررسی» همگام‌سازی را تکمیل کنید." };
    refreshCarePages();
    return { ok: true, message: "اطلاعات حساب و سامانهٔ ورود همگام شدند." };
  } catch {
    return { ok: false, message: "بررسی درخواست انجام نشد." };
  }
}
