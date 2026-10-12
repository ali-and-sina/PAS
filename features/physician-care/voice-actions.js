"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { requireVerifiedDoctor } from "@/features/doctor/access";

const VOICE_BUCKET = "pab-voice-notes";
const VOICE_CONSENT_TYPE = "physician_voice_recording";
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 60;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const MIME_EXTENSIONS = new Map([
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
]);
const ALLOWED_MIME_TYPES = new Set(MIME_EXTENSIONS.keys());

function fail(message) {
  return { ok: false, message };
}

function clean(value) {
  return String(value ?? "").trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeMimeType(value) {
  return clean(value).split(";")[0].trim().toLowerCase();
}

function isValidDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= MIN_DURATION_SECONDS && duration <= MAX_DURATION_SECONDS;
}

function isSupportedPath(path) {
  const extension = path.split(".").pop()?.toLowerCase();
  return Boolean(extension && [...MIME_EXTENSIONS.values()].includes(extension));
}

async function getDoctorPatientContext(supabase, doctorId, patientId) {
  const { data: relationship, error } = await supabase
    .from("patient_doctor_relationships")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return relationship;
}

async function hasActiveVoiceConsent(supabase, patientId) {
  const { data, error } = await supabase
    .from("consents")
    .select("id, granted_at")
    .eq("patient_id", patientId)
    .eq("consent_type", VOICE_CONSENT_TYPE)
    .eq("granted", true)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function getStoredFileMetadata(admin, storagePath) {
  const pieces = storagePath.split("/");
  const filename = pieces.pop();
  const parentPath = pieces.join("/");
  const { data, error } = await admin.storage
    .from(VOICE_BUCKET)
    .list(parentPath, { search: filename, limit: 20 });
  if (error) throw error;
  const file = (data || []).find((item) => item.name === filename);
  if (!file) return null;

  const size = Number(file.metadata?.size ?? file.metadata?.contentLength ?? file.metadata?.sizeBytes);
  const mimeType = normalizeMimeType(file.metadata?.mimetype ?? file.metadata?.mimeType ?? "");
  return { size, mimeType, metadata: file.metadata || {} };
}

export async function createVoiceNoteUpload({ patientId, duration, consentConfirmed, fileSize, mimeType } = {}) {
  try {
    const user = await getSessionUser();
    const doctor = await requireVerifiedDoctor();
    if (!user?.id || !doctor?.id || doctor.id !== user.id) return fail("دسترسی معتبر نیست.");

    patientId = clean(patientId);
    duration = Number(duration);
    fileSize = Number(fileSize);
    mimeType = normalizeMimeType(mimeType);

    if (!isUuid(patientId)) return fail("شناسه بیمار معتبر نیست.");
    if (!isValidDuration(duration)) return fail("مدت یادداشت صوتی باید بین ۳۰ تا ۶۰ ثانیه باشد.");
    if (consentConfirmed !== true) return fail("تأیید رضایت بیمار لازم است.");
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return fail("حجم فایل صوتی بیش از حد مجاز است.");
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return fail("قالب فایل صوتی پشتیبانی نمی‌شود.");

    const supabase = await createClient();
    const relationship = await getDoctorPatientContext(supabase, doctor.id, patientId);
    if (!relationship) return fail("این بیمار در فهرست بیماران فعال شما نیست.");
    if (!(await hasActiveVoiceConsent(supabase, patientId))) {
      return fail("بیمار باید رضایت ضبط یادداشت صوتی را از حساب خود ثبت کرده باشد.");
    }

    const extension = MIME_EXTENSIONS.get(mimeType);
    const voiceNoteId = crypto.randomUUID();
    const storagePath = `${doctor.id}/${voiceNoteId}/${patientId}.${extension}`;
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(VOICE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error) throw error;

    return { ok: true, voiceNoteId, storagePath, token: data?.token || null };
  } catch (error) {
    console.error("[createVoiceNoteUpload]", error);
    return fail("آماده‌سازی ثبت یادداشت صوتی انجام نشد.");
  }
}

export async function completePhysicianVoiceNote({ patientId, visitId = null, voiceNoteId, duration, storagePath, consentConfirmed } = {}) {
  let doctorId = null;
  let shouldDeleteAudio = false;

  try {
    const user = await getSessionUser();
    const doctor = await requireVerifiedDoctor();
    doctorId = doctor?.id || null;
    if (!user?.id || !doctor?.id || doctor.id !== user.id) return fail("دسترسی معتبر نیست.");

    patientId = clean(patientId);
    voiceNoteId = clean(voiceNoteId);
    visitId = clean(visitId) || null;
    storagePath = clean(storagePath);
    duration = Number(duration);

    if (!isUuid(patientId) || !isUuid(voiceNoteId) || (visitId && !isUuid(visitId))) return fail("اطلاعات یادداشت صوتی معتبر نیست.");
    if (!isValidDuration(duration)) return fail("مدت یادداشت صوتی باید بین ۳۰ تا ۶۰ ثانیه باشد.");
    if (consentConfirmed !== true) return fail("تأیید رضایت بیمار لازم است.");

    const expectedPrefix = `${doctor.id}/${voiceNoteId}/`;
    if (!storagePath.startsWith(expectedPrefix) || !isSupportedPath(storagePath)) {
      return fail("مسیر فایل صوتی معتبر نیست.");
    }

    const supabase = await createClient();
    const relationship = await getDoctorPatientContext(supabase, doctor.id, patientId);
    if (!relationship) return fail("این بیمار در فهرست بیماران فعال شما نیست.");

    // Idempotent completion for a note that was already committed.
    const existing = await supabase
      .from("voice_notes")
      .select("id, visit_id")
      .eq("id", voiceNoteId)
      .eq("doctor_id", doctor.id)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { ok: true, voiceNoteId, visitId: existing.data.visit_id };

    shouldDeleteAudio = true;
    if (!(await hasActiveVoiceConsent(supabase, patientId))) {
      return fail("رضایت فعال بیمار وجود ندارد یا لغو شده است.");
    }

    const admin = createAdminClient();
    const file = await getStoredFileMetadata(admin, storagePath);
    if (!file) return fail("فایل صوتی کامل بارگذاری نشده است.");
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return fail("اندازه واقعی فایل صوتی قابل تأیید نیست؛ فایل را دوباره بارگذاری کنید.");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      shouldDeleteAudio = true;
      return fail("حجم واقعی فایل صوتی بیش از ۲ مگابایت است.");
    }
    if (!file.mimeType || !ALLOWED_MIME_TYPES.has(file.mimeType)) {
      shouldDeleteAudio = true;
      return fail("قالب واقعی فایل صوتی قابل تأیید نیست یا مجاز نیست.");
    }

    const fileExtension = storagePath.split(".").pop()?.toLowerCase();
    if (MIME_EXTENSIONS.get(file.mimeType) !== fileExtension) {
      shouldDeleteAudio = true;
      return fail("قالب واقعی فایل با پسوند آن سازگار نیست.");
    }
    const expectedFilename = `${patientId}.${fileExtension}`;
    if (storagePath.split("/").pop() !== expectedFilename) {
      shouldDeleteAudio = true;
      return fail("نام فایل صوتی با بیمار انتخاب‌شده سازگار نیست.");
    }

    const { data: committed, error: commitError } = await supabase.rpc(
      "commit_physician_voice_note",
      {
        p_patient_id: patientId,
        p_visit_id: visitId,
        p_voice_note_id: voiceNoteId,
        p_audio_path: storagePath,
        p_duration: Number(duration.toFixed(2)),
      },
    );
    if (commitError) throw commitError;

    const committedRow = Array.isArray(committed) ? committed[0] : committed;
    const committedVisitId = committedRow?.visit_id;
    if (!committedVisitId || String(committedRow?.voice_note_id || "").toLowerCase() !== voiceNoteId.toLowerCase()) {
      throw new Error("Voice-note commit returned an invalid result");
    }

    // The RPC commits the visit transition, voice note and DB audit rows atomically.
    shouldDeleteAudio = false;
    revalidatePath(`/doctor/patients/${patientId}`);
    revalidatePath("/doctor/patients");
    revalidatePath("/doctor/dashboard");
    return { ok: true, voiceNoteId, visitId: committedVisitId };
  } catch (error) {
    console.error("[completePhysicianVoiceNote]", error);
    return fail("ثبت یادداشت صوتی انجام نشد. دوباره تلاش کنید.");
  } finally {
    // Oversized or disallowed uploaded objects are removed after metadata validation.
    // Cleanup is intentionally restricted to the exact server-issued path prefix.
    if (shouldDeleteAudio && doctorId && isUuid(voiceNoteId) && String(storagePath || "").startsWith(`${doctorId}/${voiceNoteId}/`)) {
      try {
        const admin = createAdminClient();
        const { data: linkedNote, error: linkedNoteError } = await admin
          .from("voice_notes")
          .select("id")
          .eq("id", voiceNoteId)
          .eq("doctor_id", doctorId)
          .eq("audio_path", storagePath)
          .maybeSingle();
        if (linkedNoteError) throw linkedNoteError;
        // Concurrent/idempotent completion must never delete an object that
        // another request already committed to a voice-note row.
        if (!linkedNote) await admin.storage.from(VOICE_BUCKET).remove([storagePath]);
      } catch (cleanupError) {
        console.error("[completePhysicianVoiceNote:audio-cleanup]", cleanupError);
      }
    }
  }
}
