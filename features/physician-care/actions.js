"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedDoctor } from "@/features/doctor/access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOLLOW_UP_TERMINAL_STATUSES = new Set(["completed", "cancelled"]);
const VISIT_STATUSES = new Set(["scheduled", "in_progress", "completed", "cancelled"]);
const MAX_TEXT_LENGTH = 10000;

const STRUCTURED_SUMMARY_FIELDS = [
  "chief_complaint",
  "history",
  "exam_findings",
  "clinical_assessment",
  "plan",
  "follow_up_instructions",
];

function normalizeStructuredSummary(input) {
  const supplied = getValue(input, "structuredContent") ?? getValue(input, "structured_content");
  let raw = supplied;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { error: "ساختار خلاصه معتبر نیست." };
    }
  }

  if (raw == null || raw === "") {
    raw = Object.fromEntries(
      STRUCTURED_SUMMARY_FIELDS.map((key) => [key, getValue(input, key) ?? getValue(input, `summary_${key}`)]),
    );
    if (!STRUCTURED_SUMMARY_FIELDS.some((key) => clean(raw[key]))) {
      const legacySummary = clean(getValue(input, "summary"));
      if (legacySummary) raw = { clinical_assessment: legacySummary };
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "خلاصه باید به‌صورت ساختاریافته ارسال شود." };
  }
  if (Object.keys(raw).some((key) => !STRUCTURED_SUMMARY_FIELDS.includes(key))) {
    return { error: "یکی از فیلدهای خلاصه پشتیبانی نمی‌شود." };
  }

  const content = {};
  let totalLength = 0;
  for (const key of STRUCTURED_SUMMARY_FIELDS) {
    const value = clean(raw[key]);
    if (value.length > 3000) return { error: "هر بخش خلاصه حداکثر ۳۰۰۰ نویسه است." };
    totalLength += value.length;
    if (value) content[key] = value;
  }

  if (totalLength > MAX_TEXT_LENGTH) return { error: "مجموع خلاصه حداکثر ۱۰٬۰۰۰ نویسه است." };
  if (Object.keys(content).length === 0) return { error: "حداقل یک بخش از خلاصه را تکمیل کنید." };

  return { content };
}

function fail(message) {
  return { ok: false, message };
}

function getValue(input, key) {
  if (input && typeof input.get === "function") return input.get(key);
  return input?.[key];
}

function clean(value) {
  return String(value ?? "").trim();
}

function validUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function revalidatePatientPaths(patientId) {
  revalidatePath("/doctor/dashboard");
  revalidatePath("/doctor/follow-ups");
  revalidatePath("/doctor/notes");
  revalidatePath("/doctor/patients");
  if (patientId && validUuid(patientId)) revalidatePath(`/doctor/patients/${patientId}`);
}

async function getAuthorizedDoctor() {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id || !validUuid(doctor.id)) return null;
  return doctor;
}

async function hasActiveRelationship(supabase, doctorId, patientId) {
  const { data, error } = await supabase
    .from("patient_doctor_relationships")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function createPhysicianFollowUp(_previousState, formData) {
  const input = formData ?? _previousState;
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const patientId = clean(getValue(input, "patient_id") ?? getValue(input, "patientId"));
    const title = clean(getValue(input, "title"));
    const description = clean(getValue(input, "description"));
    const dueDate = clean(getValue(input, "due_date") ?? getValue(input, "dueDate"));

    if (!validUuid(patientId)) return fail("شناسه بیمار معتبر نیست.");
    if (!title || title.length > 200) return fail("عنوان پیگیری باید بین ۱ تا ۲۰۰ نویسه باشد.");
    if (description.length > 3000) return fail("توضیحات پیگیری حداکثر ۳۰۰۰ نویسه است.");
    const parsedDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? new Date(`${dueDate}T00:00:00Z`)
      : null;
    if (!parsedDueDate || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
      return fail("تاریخ پیگیری معتبر نیست.");
    }

    const supabase = await createClient();
    if (!(await hasActiveRelationship(supabase, doctor.id, patientId))) {
      return fail("این بیمار رابطه فعال با پزشک ندارد.");
    }

    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        patient_id: patientId,
        doctor_id: doctor.id,
        title,
        description: description || null,
        due_date: dueDate,
        status: "pending",
      })
      .select("id, patient_id, doctor_id, title, description, due_date, status, created_at, completed_at, cancelled_at")
      .single();

    if (error) throw error;
    revalidatePatientPaths(patientId);
    revalidatePath("/patient/follow-ups");
    revalidatePath("/patient/notifications");
    return { ok: true, data, message: "پیگیری جدید با موفقیت ثبت شد." };
  } catch (error) {
    console.error("[createPhysicianFollowUp]", error);
    return fail("ثبت پیگیری انجام نشد. اطلاعات و دسترسی بیمار را بررسی کنید.");
  }
}

export async function updatePhysicianFollowUpStatus(_previousState, formData) {
  const input = formData ?? _previousState;
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const followUpId = clean(getValue(input, "id") ?? getValue(input, "follow_up_id"));
    const requestedStatus = clean(getValue(input, "status"));
    if (!validUuid(followUpId) || !FOLLOW_UP_TERMINAL_STATUSES.has(requestedStatus)) {
      return fail("عملیات پیگیری معتبر نیست.");
    }

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("follow_ups")
      .select("id, patient_id, status")
      .eq("id", followUpId)
      .eq("doctor_id", doctor.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return fail("پیگیری یافت نشد یا دسترسی به آن ندارید.");
    if (!(await hasActiveRelationship(supabase, doctor.id, current.patient_id))) {
      return fail("این بیمار رابطه فعال با پزشک ندارد.");
    }
    if (["completed", "cancelled"].includes(current.status)) {
      if (current.status === requestedStatus) return { ok: true, unchanged: true, message: "این پیگیری قبلاً همین وضعیت را داشته است." };
      return fail("پیگیری تکمیل‌شده یا لغوشده قابل بازگشایی نیست.");
    }

    // Database trigger owns completion/cancellation timestamps; the action
    // sends only the requested state transition, never caller-supplied times.
    const update = { status: requestedStatus };

    const { data, error } = await supabase
      .from("follow_ups")
      .update(update)
      .eq("id", followUpId)
      .eq("doctor_id", doctor.id)
      .select("id, patient_id, status, due_date, completed_at, cancelled_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("وضعیت پیگیری تغییر نکرد؛ مجوز یا وضعیت فعلی را بررسی کنید.");

    revalidatePatientPaths(current.patient_id);
    revalidatePath("/patient/follow-ups");
    revalidatePath("/patient/notifications");
    return {
      ok: true,
      data,
      message: requestedStatus === "completed" ? "پیگیری تکمیل شد." : "پیگیری لغو شد.",
    };
  } catch (error) {
    console.error("[updatePhysicianFollowUpStatus]", error);
    return fail("به‌روزرسانی پیگیری انجام نشد.");
  }
}

export async function createPhysicianVisit(input) {
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const patientId = clean(getValue(input, "patient_id") ?? getValue(input, "patientId"));
    const visitDateRaw = clean(getValue(input, "visit_date") ?? getValue(input, "visitDate"));
    if (!validUuid(patientId)) return fail("شناسه بیمار معتبر نیست.");

    let visitDate;
    if (visitDateRaw) {
      const parsed = new Date(visitDateRaw);
      if (Number.isNaN(parsed.getTime())) return fail("تاریخ ویزیت معتبر نیست.");
      visitDate = parsed.toISOString();
    }

    const supabase = await createClient();
    if (!(await hasActiveRelationship(supabase, doctor.id, patientId))) {
      return fail("این بیمار رابطه فعال با پزشک ندارد.");
    }

    const payload = { patient_id: patientId, doctor_id: doctor.id, status: "scheduled" };
    if (visitDate) payload.visit_date = visitDate;

    const { data, error } = await supabase
      .from("visits")
      .insert(payload)
      .select("id, patient_id, doctor_id, visit_date, status, created_at")
      .single();
    if (error) throw error;

    revalidatePatientPaths(patientId);
    return { ok: true, data };
  } catch (error) {
    console.error("[createPhysicianVisit]", error);
    return fail("ثبت ویزیت انجام نشد.");
  }
}

export async function updatePhysicianVisitStatus(input) {
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const visitId = clean(getValue(input, "id") ?? getValue(input, "visit_id"));
    const status = clean(getValue(input, "status"));
    if (!validUuid(visitId) || !VISIT_STATUSES.has(status)) return fail("وضعیت ویزیت معتبر نیست.");

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("visits")
      .select("id, patient_id, status")
      .eq("id", visitId)
      .eq("doctor_id", doctor.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return fail("ویزیت یافت نشد یا دسترسی به آن ندارید.");
    if (!(await hasActiveRelationship(supabase, doctor.id, current.patient_id))) {
      return fail("این بیمار رابطه فعال با پزشک ندارد.");
    }
    const allowedTransitions = {
      scheduled: new Set(["scheduled", "in_progress", "cancelled"]),
      in_progress: new Set(["in_progress", "completed", "cancelled"]),
      completed: new Set(["completed"]),
      cancelled: new Set(["cancelled"]),
    };
    if (!allowedTransitions[current.status]?.has(status)) {
      return fail("انتقال وضعیت ویزیت مجاز نیست.");
    }
    if (current.status === status) return { ok: true, unchanged: true, data: current };

    const { data, error } = await supabase
      .from("visits")
      .update({ status })
      .eq("id", visitId)
      .eq("doctor_id", doctor.id)
      .eq("status", current.status)
      .select("id, patient_id, doctor_id, visit_date, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return fail("وضعیت ویزیت هم‌زمان تغییر کرده است؛ صفحه را تازه کنید و دوباره بررسی کنید.");
    }

    revalidatePatientPaths(current.patient_id);
    return { ok: true, data };
  } catch (error) {
    console.error("[updatePhysicianVisitStatus]", error);
    return fail("به‌روزرسانی ویزیت انجام نشد.");
  }
}

async function getOwnedVoiceNote(supabase, doctorId, voiceNoteId) {
  const { data, error } = await supabase
    .from("voice_notes")
    .select("id, patient_id, visit_id, archived_at")
    .eq("id", voiceNoteId)
    .eq("doctor_id", doctorId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await hasActiveRelationship(supabase, doctorId, data.patient_id))) return null;
  return data;
}

export async function savePhysicianTranscript(input) {
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const voiceNoteId = clean(getValue(input, "voice_note_id") ?? getValue(input, "voiceNoteId"));
    const transcriptText = clean(getValue(input, "transcript_text") ?? getValue(input, "transcriptText"));
    if (!validUuid(voiceNoteId)) return fail("شناسه یادداشت صوتی معتبر نیست.");
    if (!transcriptText || transcriptText.length > MAX_TEXT_LENGTH) return fail("متن پیاده‌سازی باید بین ۱ تا ۱۰٬۰۰۰ نویسه باشد.");

    const supabase = await createClient();
    const voiceNote = await getOwnedVoiceNote(supabase, doctor.id, voiceNoteId);
    if (!voiceNote) return fail("یادداشت صوتی پیدا نشد یا دسترسی فعال ندارید.");

    const { data, error } = await supabase
      .from("transcripts")
      .upsert({ voice_note_id: voiceNoteId, transcript_text: transcriptText }, { onConflict: "voice_note_id" })
      .select("id, voice_note_id, transcript_text, created_at")
      .single();
    if (error) throw error;

    revalidatePatientPaths(voiceNote.patient_id);
    return { ok: true, data };
  } catch (error) {
    console.error("[savePhysicianTranscript]", error);
    return fail("ثبت متن پیاده‌سازی انجام نشد.");
  }
}

export async function savePhysicianVisitSummaryDraft(input) {
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");

    const voiceNoteId = clean(getValue(input, "voice_note_id") ?? getValue(input, "voiceNoteId"));
    if (!validUuid(voiceNoteId)) return fail("شناسه یادداشت صوتی معتبر نیست.");

    const normalizedSummary = normalizeStructuredSummary(input);
    if (normalizedSummary.error) return fail(normalizedSummary.error);
    const structuredContent = normalizedSummary.content;

    const supabase = await createClient();
    const voiceNote = await getOwnedVoiceNote(supabase, doctor.id, voiceNoteId);
    if (!voiceNote) return fail("یادداشت صوتی پیدا نشد یا دسترسی فعال ندارید.");

    const { data: savedSummary, error } = await supabase.rpc(
      "save_physician_visit_summary_draft",
      {
        p_voice_note_id: voiceNoteId,
        p_structured_content: structuredContent,
      },
    );
    if (error) throw error;

    const data = Array.isArray(savedSummary) ? savedSummary[0] : savedSummary;
    if (!data || data.doctor_confirmed || !data.id) {
      throw new Error("Draft summary RPC returned an invalid result.");
    }

    revalidatePatientPaths(voiceNote.patient_id);
    return { ok: true, data };
  } catch (error) {
    console.error("[savePhysicianVisitSummaryDraft]", error);
    return fail("ذخیره پیش‌نویس خلاصه انجام نشد.");
  }
}

/** This separate action is the only application path that marks a summary as confirmed. */
export async function confirmPhysicianVisitSummary(input) {
  try {
    const doctor = await getAuthorizedDoctor();
    if (!doctor) return fail("دسترسی پزشک معتبر نیست.");
    if (getValue(input, "confirmed") !== true) return fail("برای تأیید خلاصه، اقدام صریح پزشک لازم است.");

    const voiceNoteId = clean(getValue(input, "voice_note_id") ?? getValue(input, "voiceNoteId"));
    if (!validUuid(voiceNoteId)) return fail("شناسه یادداشت صوتی معتبر نیست.");

    const supabase = await createClient();
    const voiceNote = await getOwnedVoiceNote(supabase, doctor.id, voiceNoteId);
    if (!voiceNote) return fail("یادداشت صوتی پیدا نشد یا دسترسی فعال ندارید.");

    const { data: existing, error: existingError } = await supabase
      .from("visit_summaries")
      .select("id, doctor_confirmed")
      .eq("voice_note_id", voiceNoteId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return fail("ابتدا پیش‌نویس خلاصه را ثبت کنید.");
    if (existing.doctor_confirmed) return { ok: true, alreadyConfirmed: true };

    const { error: confirmationError } = await supabase.rpc(
      "confirm_physician_visit_summary",
      { p_voice_note_id: voiceNoteId },
    );
    if (confirmationError) throw confirmationError;

    const { data, error } = await supabase
      .from("visit_summaries")
      .select("id, voice_note_id, summary, structured_content, doctor_confirmed, confirmed_at, created_at, updated_at")
      .eq("voice_note_id", voiceNoteId)
      .single();
    if (error) throw error;
    if (!data?.doctor_confirmed || !data.confirmed_at) {
      return fail("خلاصه تأیید نشد؛ وضعیت فعلی را دوباره بررسی کنید.");
    }

    revalidatePatientPaths(voiceNote.patient_id);
    return { ok: true, data };
  } catch (error) {
    console.error("[confirmPhysicianVisitSummary]", error);
    return fail("تأیید خلاصه انجام نشد.");
  }
}
