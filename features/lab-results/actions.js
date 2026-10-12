"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getLabOrderTests, getLabReport } from "@/features/lab/queries";
import { getTestDisplayName } from "@/lib/medical/test-name";
import {
  buildReferenceSnapshot,
  calculateNumericFlag,
  resolveReferenceRanges,
} from "@/features/lab-results/ranges";

const ORDER_SELECT =
  "id, patient_id, doctor_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function fail(message) {
  return {
    ok: false,
    message,
  };
}

async function getLaboratoryContext() {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "laboratory") {
    return null;
  }

  const supabase = await createClient();

  const { data: laboratory, error } = await supabase
    .from("laboratory_profiles")
    .select("id, license_number, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!laboratory) return null;

  return {
    user,
    laboratory,
    supabase,
  };
}

function parseObservationValue(test, rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return {
      ok: false,
      message: `نتیجه «${getTestDisplayName(test)}» الزامی است.`,
    };
  }

  if (test.value_type === "numeric") {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return {
        ok: false,
        message: `مقدار «${getTestDisplayName(test)}» باید عددی باشد.`,
      };
    }

    if (numeric < 0 && test.allows_negative !== true) {
      return {
        ok: false,
        message: `برای آزمایش «${getTestDisplayName(test)}» مقدار منفی مجاز نیست.`,
      };
    }

    return {
      ok: true,
      value_numeric: numeric,
      value_text: null,
      value_boolean: null,
    };
  }

  if (test.value_type === "boolean") {
    if (value !== "true" && value !== "false") {
      return {
        ok: false,
        message: `نتیجه «${getTestDisplayName(test)}» باید یکی از مقادیر بله/خیر باشد.`,
      };
    }

    return {
      ok: true,
      value_numeric: null,
      value_text: null,
      value_boolean: value === "true",
    };
  }

  if (test.value_type === "text") {
    return {
      ok: true,
      value_numeric: null,
      value_text: value,
      value_boolean: null,
    };
  }

  return {
    ok: false,
    message: `نوع مقدار آزمایش «${getTestDisplayName(test)}» پشتیبانی نمی‌شود.`,
  };
}

function sameObservationValue(observation, parsed) {
  return (
    (observation.value_numeric ?? null) ===
      (parsed.value_numeric ?? null) &&
    (observation.value_text ?? null) ===
      (parsed.value_text ?? null) &&
    (observation.value_boolean ?? null) ===
      (parsed.value_boolean ?? null)
  );
}

async function ensureDraftReport(supabase, orderId, laboratoryId) {
  const { data: drafts, error: draftError } = await supabase
    .from("diagnostic_reports")
    .select("id, status")
    .eq("lab_order_id", orderId)
    .eq("laboratory_id", laboratoryId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  if (draftError) throw draftError;

  if (drafts?.[0]) return drafts[0];

  const { data: report, error: reportError } = await supabase
    .from("diagnostic_reports")
    .insert({
      lab_order_id: orderId,
      laboratory_id: laboratoryId,
      status: "draft",
      entered_by: laboratoryId,
    })
    .select("id, status")
    .single();

  if (!reportError) return report;

  if (reportError.code === "23505") {
    const { data: retryReport, error: retryError } = await supabase
      .from("diagnostic_reports")
      .select("id, status")
      .eq("lab_order_id", orderId)
      .eq("laboratory_id", laboratoryId)
      .eq("status", "draft")
      .maybeSingle();

    if (retryError) throw retryError;
    if (retryReport) return retryReport;
  }

  throw reportError;
}

async function savePreliminaryObservations({
  supabase,
  admin,
  reportId,
  patientId,
  tests,
  formData,
  laboratoryId,
}) {
  const { data: existing, error: existingError } = await supabase
    .from("observations")
    .select(
      "id, test_definition_id, value_numeric, value_text, value_boolean, status, unit, reference_range_template_id, reference_min, reference_max, reference_text, reference_source, flag",
    )
    .eq("diagnostic_report_id", reportId)
    .in("status", ["preliminary", "final", "corrected", "superseded"])
    .order("created_at", { ascending: true });

  if (existingError) throw existingError;

  const currentByTest = new Map();

  for (const observation of existing || []) {
    if (observation.status === "superseded") continue;
    currentByTest.set(observation.test_definition_id, observation);
  }

  const references = await resolveReferenceRanges({
    admin,
    laboratoryId,
    patientId,
    testDefinitionIds: tests.map((test) => test.id),
  });

  for (const test of tests) {
    const rawValue = formData.get(`value_${test.id}`);
    const hasValue = String(rawValue ?? "").trim() !== "";
    const current = currentByTest.get(test.id) || null;

    if (!hasValue && test.is_required === false) {
      if (current?.status === "preliminary") {
        const { error: supersedeError } = await supabase
          .from("observations")
          .update({ status: "superseded" })
          .eq("id", current.id)
          .eq("status", "preliminary");

        if (supersedeError) throw supersedeError;
      }

      continue;
    }

    const parsed = parseObservationValue(test, rawValue);

    if (!parsed.ok) return parsed;

    const reference = buildReferenceSnapshot(
      test,
      references.get(test.id) || null,
    );

    if (reference.ok === false) return reference;

    if (current && sameObservationValue(current, parsed)) {
      if (current.status !== "preliminary") {
        return {
          ok: false,
          message:
            "این گزارش دیگر پیش‌نویس قابل ویرایش نیست و باید از مسیر اصلاح نتیجه ادامه داده شود.",
        };
      }

      continue;
    }

    if (current) {
      if (current.status !== "preliminary") {
        return {
          ok: false,
          message:
            "نتیجهٔ فعلی این آزمایش قابل ویرایش مستقیم نیست؛ از مسیر اصلاح نتیجه استفاده کنید.",
        };
      }

      const { error: supersedeError } = await supabase
        .from("observations")
        .update({ status: "superseded" })
        .eq("id", current.id)
        .eq("status", "preliminary");

      if (supersedeError) throw supersedeError;
    }

    const flag =
      test.value_type === "numeric"
        ? calculateNumericFlag(parsed.value_numeric, reference)
        : "normal";

    const { error: insertError } = await supabase
      .from("observations")
      .insert({
        diagnostic_report_id: reportId,
        test_definition_id: test.id,
        value_numeric: parsed.value_numeric,
        value_text: parsed.value_text,
        value_boolean: parsed.value_boolean,
        unit: reference.unit,
        reference_range_template_id:
          reference.reference_range_template_id,
        reference_min: reference.reference_min,
        reference_max: reference.reference_max,
        reference_text: reference.reference_text,
        reference_source: reference.reference_source,
        flag,
        status: "preliminary",
        supersedes_observation_id: null,
        entered_by: laboratoryId,
      });

    if (insertError) throw insertError;
  }

  return { ok: true };
}

export async function updateLabOrderStatus(formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی آزمایشگاه معتبر نیست.");
    }

    const { user, supabase } = context;
    const orderId = String(formData.get("order_id") || "").trim();
    const nextStatus = String(formData.get("status") || "").trim();

    if (!orderId) return fail("شناسه سفارش معتبر نیست.");

    const allowedStatuses = new Set([
      "received_by_lab",
      "in_progress",
      "completed",
      "cancelled",
    ]);

    if (!allowedStatuses.has(nextStatus)) {
      return fail("وضعیت انتخاب‌شده معتبر نیست.");
    }

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("laboratory_id", user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("سفارش پیدا نشد.");

    if (nextStatus === "received_by_lab" && order.status !== "pending") {
      return fail("فقط سفارش در انتظار را می‌توان دریافت کرد.");
    }

    if (
      nextStatus === "in_progress" &&
      order.status !== "received_by_lab"
    ) {
      return fail(
        "برای شروع انجام آزمایش، سفارش باید ابتدا دریافت شده باشد.",
      );
    }

    if (nextStatus === "completed" && order.status !== "in_progress") {
      return fail(
        "برای تکمیل سفارش، وضعیت سفارش باید در حال انجام باشد.",
      );
    }

    if (nextStatus === "cancelled") {
      if (![
        "pending",
        "received_by_lab",
        "in_progress",
      ].includes(order.status)) {
        return fail("این سفارش دیگر قابل لغو نیست.");
      }
    }

    const payload = { status: nextStatus };

    if (nextStatus === "received_by_lab") {
      payload.received_at = new Date().toISOString();
    }

    if (nextStatus === "completed") {
      const { data: finalReports, error: reportError } = await supabase
        .from("diagnostic_reports")
        .select("id")
        .eq("lab_order_id", order.id)
        .eq("laboratory_id", user.id)
        .eq("status", "final")
        .limit(1);

      if (reportError) throw reportError;

      if (!finalReports?.length) {
        return fail("سفارش بدون گزارش نهایی معتبر قابل تکمیل نیست.");
      }

      payload.completed_at = new Date().toISOString();
    }

    if (nextStatus === "cancelled") {
      payload.cancelled_at = new Date().toISOString();
    }

    // Compare-and-set: only the request that still sees the status it read
    // may advance the order. This prevents two concurrent actions from both
    // succeeding from the same prior state.
    const { data: updatedRows, error: updateError } = await supabase
      .from("lab_orders")
      .update(payload)
      .eq("id", order.id)
      .eq("laboratory_id", user.id)
      .eq("status", order.status)
      .select("id");

    if (updateError) throw updateError;
    if (!updatedRows?.length) {
      return fail("وضعیت سفارش هم‌زمان توسط کاربر دیگری تغییر کرده است. صفحه را تازه‌سازی و دوباره بررسی کنید.");
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath("/lab/results");
    revalidatePath("/lab/dashboard");
    revalidatePath("/doctor/lab-orders");
    revalidatePath("/patient/lab-orders");

    return {
      ok: true,
      status: nextStatus,
      message: "وضعیت سفارش با موفقیت به‌روزرسانی شد.",
    };
  } catch (error) {
    console.error("[updateLabOrderStatus]", error);
    return fail(error?.message || "به‌روزرسانی وضعیت سفارش انجام نشد.");
  }
}


const RESULT_ATTACHMENT_BUCKET = "pab-lab-result-attachments";
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(file) {
  return Boolean(
    file &&
      typeof file === "object" &&
      typeof file.size === "number" &&
      file.size > 0 &&
      file.size <= MAX_PDF_SIZE_BYTES &&
      String(file.type || "").toLowerCase() === "application/pdf",
  );
}

async function saveLabReportAttachment({
  supabase,
  admin,
  laboratoryId,
  reportId,
  file,
}) {
  if (!file || file.size === 0) return null;

  if (!isPdfFile(file)) {
    return fail("فایل پیوست باید از نوع پی‌دی‌اف و حداکثر ۱۰ مگابایت باشد.");
  }

  const safeName = String(file.name || "report.pdf")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120) || "report.pdf";

  const storagePath = `${laboratoryId}/${reportId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from(RESULT_ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      diagnostic_report_id: reportId,
      uploaded_by: laboratoryId,
      storage_path: storagePath,
      file_name: String(file.name || "report.pdf").slice(0, 255),
      file_type: "application/pdf",
      file_size_bytes: file.size,
    })
    .select("id, diagnostic_report_id, file_name, file_type, file_size_bytes, storage_path, created_at")
    .single();

  if (attachmentError) {
    await admin.storage.from(RESULT_ATTACHMENT_BUCKET).remove([storagePath]);
    throw attachmentError;
  }

  try {
    await admin.from("audit_logs").insert({
      actor_id: laboratoryId,
      action: "attachment_created",
      entity_type: "attachment",
      entity_id: attachment.id,
      metadata: {
        operation: "uploaded",
        diagnostic_report_id: reportId,
        file_type: "application/pdf",
      },
    });
  } catch (auditError) {
    console.error("[saveLabReportAttachment:audit]", auditError);
  }

  return attachment;
}

export async function uploadLabReportAttachment(_previousState, formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) return fail("دسترسی آزمایشگاه معتبر نیست.");

    const { user, supabase } = context;
    const reportId = String(formData.get("report_id") || "").trim();
    const file = formData.get("pdf");

    if (!reportId || !isUuid(reportId)) {
      return fail("شناسه گزارش معتبر نیست.");
    }

    const { data: report, error } = await supabase
      .from("diagnostic_reports")
      .select("id, laboratory_id, status")
      .eq("id", reportId)
      .eq("laboratory_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!report) return fail("گزارش انتخاب‌شده معتبر نیست.");

    const attachment = await saveLabReportAttachment({
      supabase,
      admin: createAdminClient(),
      laboratoryId: user.id,
      reportId,
      file,
    });

    if (!attachment) return fail("فایلی برای بارگذاری انتخاب نشده است.");

    revalidatePath(`/lab/results/${reportId}`);
    revalidatePath(`/lab/results/${reportId}/correct`);

    return {
      ok: true,
      attachmentId: attachment.id,
      message: "فایل گزارش با موفقیت پیوست شد.",
    };
  } catch (error) {
    console.error("[uploadLabReportAttachment]", error);
    return fail(error?.message || "بارگذاری فایل گزارش انجام نشد.");
  }
}

export async function importLabResultRows(_previousState, formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) return fail("دسترسی آزمایشگاه معتبر نیست.");

    const { user, supabase } = context;
    const orderId = String(formData.get("order_id") || "").trim();
    const rawRows = String(formData.get("rows_json") || "").trim();

    if (!orderId || !isUuid(orderId)) return fail("شناسه سفارش معتبر نیست.");
    if (!rawRows) return fail("داده‌ای برای ورود گروهی ارسال نشده است.");

    let rows;
    try {
      rows = JSON.parse(rawRows);
    } catch {
      return fail("ساختار داده ورود گروهی معتبر نیست.");
    }

    const { bulkResultRowsSchema } = await import("@/features/lab-results/schemas");
    const parsedRows = bulkResultRowsSchema.safeParse(rows);

    if (!parsedRows.success) {
      return fail(parsedRows.error.issues[0]?.message || "داده‌های ورود گروهی معتبر نیستند.");
    }

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("laboratory_id", user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("سفارش پیدا نشد.");
    if (order.status !== "in_progress") {
      return fail("ورود نتیجه فقط برای سفارش در حال انجام مجاز است.");
    }

    const tests = await getLabOrderTests(order.id);
    const testsById = new Map(tests.map((test) => [test.id.toLowerCase(), test]));
    const testsByCode = new Map(
      tests.map((test) => [String(test.internal_code || "").trim().toLowerCase(), test]),
    );

    const { data: aliases, error: aliasesError } = await supabase
      .from("test_aliases")
      .select("alias, test_definition_id, source_lab_id")
      .in("test_definition_id", tests.map((test) => test.id));

    if (aliasesError) throw aliasesError;

    const testsByAlias = new Map();
    for (const alias of aliases || []) {
      const test = testsById.get(String(alias.test_definition_id || "").toLowerCase());
      if (test && (!alias.source_lab_id || alias.source_lab_id === user.id)) {
        testsByAlias.set(String(alias.alias || "").trim().toLowerCase(), test);
      }
    }

    const preparedFormData = new FormData();
    preparedFormData.set("order_id", order.id);

    const seen = new Set();

    for (const row of parsedRows.data) {
      const key = row.test_key.trim().toLowerCase();
      const test = testsById.get(key) || testsByCode.get(key) || testsByAlias.get(key);

      if (!test) {
        return fail(`تست «${row.test_key}» در این سفارش وجود ندارد.`);
      }

      if (seen.has(test.id)) {
        return fail(`تست «${getTestDisplayName(test)}» بیش از یک‌بار ارسال شده است.`);
      }

      seen.add(test.id);
      preparedFormData.set(`value_${test.id}`, row.value);
    }

    const report = await ensureDraftReport(supabase, order.id, user.id);
    const admin = createAdminClient();

    const result = await savePreliminaryObservations({
      supabase,
      admin,
      reportId: report.id,
      patientId: order.patient_id,
      tests,
      formData: preparedFormData,
      laboratoryId: user.id,
    });

    if (!result.ok) return result;

    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath(`/lab/orders/${order.id}/results/new`);
    revalidatePath("/lab/results");
    revalidatePath("/lab/dashboard");

    return {
      ok: true,
      reportId: report.id,
      imported: parsedRows.data.length,
      message: `${parsedRows.data.length} نتیجه به‌صورت پیش‌نویس ثبت شد.`,
    };
  } catch (error) {
    console.error("[importLabResultRows]", error);
    return fail(error?.message || "ورود گروهی نتایج انجام نشد.");
  }
}

export async function finalizeLabReport(formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) return fail("دسترسی آزمایشگاه معتبر نیست.");

    const { user, supabase } = context;
    const reportId = String(formData.get("report_id") || "").trim();

    if (!reportId || !isUuid(reportId)) return fail("شناسه گزارش معتبر نیست.");

    const { data: report, error: reportError } = await supabase
      .from("diagnostic_reports")
      .select("id, lab_order_id, status")
      .eq("id", reportId)
      .eq("laboratory_id", user.id)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) return fail("گزارش پیدا نشد.");

    const { data: finalReportId, error: finalizeError } = await supabase.rpc(
      "finalize_lab_report",
      { p_report_id: report.id },
    );

    if (finalizeError) {
      return fail(finalizeError.message || "نهایی‌سازی گزارش انجام نشد.");
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${report.lab_order_id}`);
    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/${finalReportId}`);
    revalidatePath("/lab/dashboard");

    return { ok: true, reportId: finalReportId };
  } catch (error) {
    console.error("[finalizeLabReport]", error);
    return fail(error?.message || "نهایی‌سازی گزارش انجام نشد.");
  }
}

export async function saveLabResults(_previousState, formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی آزمایشگاه معتبر نیست.");
    }

    const { user, supabase } = context;
    const orderId = String(formData.get("order_id") || "").trim();
    const requestedReportId = String(
      formData.get("report_id") || "",
    ).trim();
    const finalize =
      String(formData.get("finalize") || "false") === "true";

    if (!orderId) return fail("شناسه سفارش معتبر نیست.");

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("laboratory_id", user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("سفارش پیدا نشد.");

    if (order.status !== "in_progress") {
      return fail(
        "برای ثبت نتیجه، سفارش باید در وضعیت «در حال انجام» باشد.",
      );
    }

    const tests = await getLabOrderTests(order.id);

    if (!tests.length) {
      return fail("برای این سفارش تستی تعریف نشده است.");
    }

    const report = await ensureDraftReport(supabase, order.id, user.id);

    if (requestedReportId && requestedReportId !== report.id) {
      return fail("گزارش انتخاب‌شده متعلق به این سفارش نیست.");
    }

    const admin = createAdminClient();

    const result = await savePreliminaryObservations({
      supabase,
      admin,
      reportId: report.id,
      patientId: order.patient_id,
      tests,
      formData,
      laboratoryId: user.id,
    });

    if (!result.ok) return result;

    const pdfFile = formData.get("pdf");
    if (pdfFile && typeof pdfFile === "object" && pdfFile.size > 0) {
      const attachmentResult = await saveLabReportAttachment({
        supabase,
        admin,
        laboratoryId: user.id,
        reportId: report.id,
        file: pdfFile,
      });

      if (attachmentResult?.ok === false) return attachmentResult;
    }

    if (!finalize) {
      revalidatePath(`/lab/orders/${order.id}`);
      revalidatePath(`/lab/orders/${order.id}/results/new`);
      revalidatePath("/lab/results");
      revalidatePath("/lab/dashboard");

      return {
        ok: true,
        message: "پیش‌نویس نتایج ذخیره شد.",
        reportId: report.id,
      };
    }

    const { data: finalReportId, error: finalizeError } = await supabase.rpc(
      "finalize_lab_report",
      {
        p_report_id: report.id,
      },
    );

    if (finalizeError) {
      console.error("[saveLabResults:finalize]", finalizeError);
      return fail(
        finalizeError.message || "نهایی‌سازی گزارش انجام نشد.",
      );
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/${finalReportId}`);
    revalidatePath("/lab/dashboard");

    redirect(`/lab/results/${finalReportId}`);
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("[saveLabResults]", error);

    return fail(
      error?.message || "در ذخیره یا نهایی‌سازی نتایج خطایی رخ داد.",
    );
  }
}

export async function correctLabResult(_previousState, formData) {
  try {
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی آزمایشگاه معتبر نیست.");
    }

    const { user, supabase } = context;
    const reportId = String(formData.get("report_id") || "").trim();
    const observationId = String(
      formData.get("observation_id") || "",
    ).trim();
    const rawValue = String(formData.get("value") || "").trim();

    if (!reportId || !observationId) {
      return fail("شناسه گزارش یا نتیجه معتبر نیست.");
    }

    const report = await getLabReport(reportId);

    if (!report || report.order?.laboratory_id !== user.id) {
      return fail("گزارش انتخاب‌شده معتبر نیست.");
    }

    if (!["final", "amended"].includes(report.status)) {
      return fail(
        "فقط گزارش نهایی یا اصلاح‌شده را می‌توان اصلاح کرد.",
      );
    }

    const observation =
      report.observations.find((item) => item.id === observationId) || null;

    if (!observation) return fail("نتیجه انتخاب‌شده پیدا نشد.");

    if (!["final", "corrected"].includes(observation.status)) {
      return fail(
        "فقط آخرین نتیجه نهایی یا اصلاح‌شده قابل اصلاح است.",
      );
    }

    const parsed = parseObservationValue(observation.test, rawValue);

    if (!parsed.ok) return parsed;

    const { data: newObservationId, error } = await supabase.rpc(
      "correct_lab_observation",
      {
        p_report_id: reportId,
        p_observation_id: observationId,
        p_value_numeric: parsed.value_numeric,
        p_value_text: parsed.value_text,
        p_value_boolean: parsed.value_boolean,
      },
    );

    if (error) {
      console.error("[correctLabResult]", error);
      return fail(error.message || "اصلاح نتیجه انجام نشد.");
    }

    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/${reportId}`);
    revalidatePath(`/lab/results/${reportId}/correct`);
    revalidatePath("/lab/dashboard");

    return {
      ok: true,
      message: "اصلاح نتیجه با موفقیت ثبت شد.",
      observationId: newObservationId,
    };
  } catch (error) {
    console.error("[correctLabResult]", error);
    return fail(error?.message || "در اصلاح نتیجه خطایی رخ داد.");
  }
}
