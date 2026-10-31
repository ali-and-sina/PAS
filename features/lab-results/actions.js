"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getLabOrderTests, getLabReport } from "@/features/lab/queries";
import { getTestDisplayName } from "@/lib/medical/test-name";

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
    if (value.length > 1000) {
      return {
        ok: false,
        message: `نتیجه متنی «${getTestDisplayName(test)}» نباید بیش از ۱۰۰۰ نویسه باشد.`,
      };
    }

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

function prepareObservationRows(tests, formData) {
  const rows = [];

  for (const test of tests) {
    const rawValue = formData.get(`value_${test.id}`);
    const hasValue = String(rawValue ?? "").trim() !== "";

    if (!hasValue) {
      if (test.is_required !== false) {
        return {
          ok: false,
          message: `نتیجه «${getTestDisplayName(test)}» الزامی است.`,
        };
      }

      rows.push({
        test_definition_id: test.id,
        has_value: false,
        value_numeric: null,
        value_text: null,
        value_boolean: null,
      });
      continue;
    }

    const parsed = parseObservationValue(test, rawValue);
    if (!parsed.ok) return parsed;

    rows.push({
      test_definition_id: test.id,
      has_value: true,
      value_numeric: parsed.value_numeric,
      value_text: parsed.value_text,
      value_boolean: parsed.value_boolean,
    });
  }

  return { ok: true, observations: rows };
}

async function saveLabResultsAtomically({
  supabase,
  orderId,
  requestedReportId = null,
  observations,
  finalize = false,
}) {
  const { data, error } = await supabase.rpc("save_lab_results_atomic", {
    p_order_id: orderId,
    p_report_id: requestedReportId,
    p_observations: observations,
    p_finalize: finalize,
  });

  if (error) throw error;
  if (!data?.ok || !data?.report_id) {
    throw new Error("The database did not confirm saving the laboratory results.");
  }

  return data;
}

export async function updateLabOrderStatus(formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی آزمایشگاه معتبر نیست.");
    }

    const { supabase } = context;
    const orderId = String(formData.get("order_id") || "").trim();
    const nextStatus = String(formData.get("status") || "").trim();

    if (!orderId) return fail("شناسه پذیرش معتبر نیست.");

    // Completion is only allowed through saveLabResults + the atomic database
    // finalizer so the report and order cannot diverge.
    const allowedStatuses = new Set([
      "received_by_lab",
      "in_progress",
      "cancelled",
    ]);

    if (!allowedStatuses.has(nextStatus)) {
      return fail("وضعیت انتخاب‌شده معتبر نیست.");
    }

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("پذیرش پیدا نشد.");

    if (nextStatus === "received_by_lab" && order.status !== "pending") {
      return fail("فقط درخواست‌های در انتظار را می‌توان پذیرفت.");
    }

    if (
      nextStatus === "in_progress" &&
      order.status !== "received_by_lab"
    ) {
      return fail(
        "برای شروع انجام آزمایش، ابتدا پذیرش آن را ثبت کنید.",
      );
    }

    if (nextStatus === "cancelled") {
      if (![
        "pending",
        "received_by_lab",
        "in_progress",
      ].includes(order.status)) {
        return fail("این پذیرش دیگر قابل لغو نیست.");
      }
    }

    const payload = { status: nextStatus };

    if (nextStatus === "received_by_lab") {
      payload.received_at = new Date().toISOString();
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
      .eq("status", order.status)
      .select("id");

    if (updateError) throw updateError;
    if (!updatedRows?.length) {
      return fail("وضعیت پذیرش هم‌زمان توسط کاربر دیگری تغییر کرده است. صفحه را تازه‌سازی و دوباره بررسی کنید.");
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath("/lab/results");
    revalidatePath("/lab/dashboard");
    revalidatePath("/doctor/lab-orders");
    revalidatePath("/doctor/medical-services");
    revalidatePath("/patient/lab-orders");
    revalidatePath("/patient/medical-services");

    return {
      ok: true,
      status: nextStatus,
      message: "وضعیت پذیرش با موفقیت به‌روزرسانی شد.",
    };
  } catch (error) {
    console.error("[updateLabOrderStatus]", error);
    return fail("به‌روزرسانی وضعیت پذیرش انجام نشد.");
  }
}


const RESULT_ATTACHMENT_BUCKET = "pab-lab-result-attachments";
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

async function isPdfFile(file) {
  if (
    !file ||
    typeof file !== "object" ||
    typeof file.size !== "number" ||
    file.size < 5 ||
    file.size > MAX_PDF_SIZE_BYTES ||
    String(file.type || "").toLowerCase() !== "application/pdf" ||
    typeof file.arrayBuffer !== "function" ||
    typeof file.slice !== "function"
  ) {
    return false;
  }

  // MIME type is controlled by the client. Require the PDF magic header too.
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return header.length === 5 && String.fromCharCode(...header) === "%PDF-";
}

async function saveLabReportAttachment({
  supabase,
  admin,
  laboratoryId,
  reportId,
  file,
}) {
  if (!file || file.size === 0) return null;

  if (!(await isPdfFile(file))) {
    return fail("فایل پیوست باید PDF واقعی و حداکثر ۱۰ مگابایت باشد.");
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
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

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
    if (attachment.ok === false) return attachment;

    revalidatePath(`/lab/results/${reportId}`);
    revalidatePath(`/lab/results/${reportId}/correct`);
    revalidatePath("/doctor/medical-services");
    revalidatePath("/patient/medical-services");

    return {
      ok: true,
      attachmentId: attachment.id,
      message: "فایل گزارش با موفقیت پیوست شد.",
    };
  } catch (error) {
    console.error("[uploadLabReportAttachment]", error);
    return fail("بارگذاری فایل گزارش انجام نشد.");
  }
}

export async function importLabResultRows(_previousState, formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

    const context = await getLaboratoryContext();

    if (!context) return fail("دسترسی آزمایشگاه معتبر نیست.");

    const { user, supabase } = context;
    const orderId = String(formData.get("order_id") || "").trim();
    const rawRows = String(formData.get("rows_json") || "").trim();

    if (!orderId || !isUuid(orderId)) return fail("شناسه پذیرش معتبر نیست.");
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
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("پذیرش پیدا نشد.");
    if (order.status !== "in_progress") {
      return fail("ثبت نتیجه فقط برای پذیرشی که در حال انجام است مجاز است.");
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
      if (test && (!alias.source_lab_id || alias.source_lab_id === order.laboratory_id)) {
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
        return fail(`تست «${row.test_key}» در این پذیرش وجود ندارد.`);
      }

      if (seen.has(test.id)) {
        return fail(`تست «${getTestDisplayName(test)}» بیش از یک‌بار ارسال شده است.`);
      }

      seen.add(test.id);
      preparedFormData.set(`value_${test.id}`, row.value);
    }

    const prepared = prepareObservationRows(tests, preparedFormData);
    if (!prepared.ok) return prepared;

    const saved = await saveLabResultsAtomically({
      supabase,
      orderId: order.id,
      observations: prepared.observations,
    });

    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath(`/lab/orders/${order.id}/results/new`);
    revalidatePath("/lab/results");
    revalidatePath("/lab/dashboard");

    return {
      ok: true,
      reportId: saved.report_id,
      imported: parsedRows.data.length,
      message: `${parsedRows.data.length} نتیجه به‌صورت پیش‌نویس ثبت شد.`,
    };
  } catch (error) {
    console.error("[importLabResultRows]", error);
    return fail("ورود گروهی نتایج انجام نشد.");
  }
}

export async function finalizeLabReport(formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

    const context = await getLaboratoryContext();

    if (!context) return fail("دسترسی آزمایشگاه معتبر نیست.");

    const { supabase } = context;
    const reportId = String(formData.get("report_id") || "").trim();

    if (!reportId || !isUuid(reportId)) return fail("شناسه گزارش معتبر نیست.");

    const { data: report, error: reportError } = await supabase
      .from("diagnostic_reports")
      .select("id, lab_order_id, status")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) return fail("گزارش پیدا نشد.");

    const { data: finalReportId, error: finalizeError } = await supabase.rpc(
      "finalize_lab_report",
      { p_report_id: report.id },
    );

    if (finalizeError) {
      console.error("[finalizeLabReport:rpc]", finalizeError);
      return fail("گزارش نهایی نشد؛ وضعیت پذیرش و نتایج الزامی را بررسی کنید.");
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${report.lab_order_id}`);
    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/${finalReportId}`);
    revalidatePath("/lab/dashboard");

    return { ok: true, reportId: finalReportId };
  } catch (error) {
    console.error("[finalizeLabReport]", error);
    return fail("نهایی‌سازی گزارش انجام نشد.");
  }
}

export async function saveLabResults(_previousState, formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

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

    if (!orderId) return fail("شناسه پذیرش معتبر نیست.");

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail("پذیرش پیدا نشد.");

    if (order.status !== "in_progress") {
      return fail(
        "برای ثبت نتیجه، پذیرش باید در وضعیت «در حال انجام» باشد.",
      );
    }

    const tests = await getLabOrderTests(order.id);

    if (!tests.length) {
      return fail("برای این پذیرش تستی تعریف نشده است.");
    }

    const prepared = prepareObservationRows(tests, formData);
    if (!prepared.ok) return prepared;

    const pdfFile = formData.get("pdf");
    if (pdfFile && typeof pdfFile === "object" && pdfFile.size > 0) {
      if (!(await isPdfFile(pdfFile))) {
        return fail("فایل پیوست باید PDF واقعی و حداکثر ۱۰ مگابایت باشد.");
      }
    }

    // The RPC creates/reuses the draft, validates every result, supersedes old
    // preliminary rows, inserts replacements and optionally finalizes inside
    // one PostgreSQL transaction. No partial result batch is committed.
    const saved = await saveLabResultsAtomically({
      supabase,
      orderId: order.id,
      requestedReportId: requestedReportId || null,
      observations: prepared.observations,
      finalize,
    });
    const reportId = saved.report_id;
    const admin = createAdminClient();
    let attachmentWarning = null;

    // Object storage cannot share the PostgreSQL transaction. Validate the
    // PDF before committing results and compensate by deleting an uploaded
    // object if its metadata row cannot be inserted.
    if (pdfFile && typeof pdfFile === "object" && pdfFile.size > 0) {
      try {
        const attachmentResult = await saveLabReportAttachment({
          supabase,
          admin,
          laboratoryId: user.id,
          reportId,
          file: pdfFile,
        });
        if (attachmentResult?.ok === false) {
          attachmentWarning = attachmentResult.message || "پیوست PDF ذخیره نشد.";
        }
      } catch (attachmentError) {
        // Results may already have been committed. Do not report the entire
        // operation as failed when only the separately stored PDF failed.
        console.error("[saveLabResults:attachment]", attachmentError);
        attachmentWarning = "پیوست PDF ذخیره نشد؛ نتایج در دیتابیس محفوظ هستند.";
      }
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath(`/lab/orders/${order.id}/results/new`);
    revalidatePath("/lab/results");
    revalidatePath("/lab/dashboard");
    revalidatePath("/doctor/medical-services");
    revalidatePath("/patient/medical-services");

    if (!finalize) {
      return {
        ok: true,
        message: attachmentWarning
          ? `پیش‌نویس نتایج ذخیره شد، اما پیوست بارگذاری نشد: ${attachmentWarning}`
          : "پیش‌نویس نتایج ذخیره شد.",
        reportId,
      };
    }

    revalidatePath(`/lab/results/${reportId}`);
    revalidatePath("/doctor/medical-services");
    revalidatePath("/patient/medical-services");
    if (attachmentWarning) {
      return {
        ok: true,
        message: `گزارش نهایی شد، اما پیوست بارگذاری نشد: ${attachmentWarning}`,
        reportId,
      };
    }
    redirect(`/lab/results/${reportId}`);
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("[saveLabResults]", error);

    return fail(
      "در ذخیره یا نهایی‌سازی نتایج خطایی رخ داد.",
    );
  }
}

export async function correctLabResult(_previousState, formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم معتبر نیست؛ صفحه را تازه‌سازی و دوباره ارسال کنید.");
    }

    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی آزمایشگاه معتبر نیست.");
    }

    const { supabase } = context;
    const reportId = String(formData.get("report_id") || "").trim();
    const observationId = String(
      formData.get("observation_id") || "",
    ).trim();
    const rawValue = String(formData.get("value") || "").trim();

    if (!reportId || !observationId) {
      return fail("شناسه گزارش یا نتیجه معتبر نیست.");
    }

    const report = await getLabReport(reportId);

    if (!report) {
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
      return fail("اصلاح نتیجه انجام نشد.");
    }

    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/${reportId}`);
    revalidatePath(`/lab/results/${reportId}/correct`);
    revalidatePath("/doctor/medical-services");
    revalidatePath("/patient/medical-services");
    revalidatePath("/lab/dashboard");

    return {
      ok: true,
      message: "اصلاح نتیجه با موفقیت ثبت شد.",
      observationId: newObservationId,
    };
  } catch (error) {
    console.error("[correctLabResult]", error);
    return fail("در اصلاح نتیجه خطایی رخ داد.");
  }
}
