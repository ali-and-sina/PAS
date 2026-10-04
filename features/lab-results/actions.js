"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getLabOrderTests } from "@/features/lab/queries";

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
    .select("id, license_number")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!laboratory) {
    return null;
  }

  return {
    user,
    laboratory,
  };
}

async function getOwnedOrder(supabase, laboratoryId, orderId) {
  const { data, error } = await supabase
    .from("lab_orders")
    .select(
      "id, patient_id, doctor_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at",
    )
    .eq("id", orderId)
    .eq("laboratory_id", laboratoryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function parseObservationValue(test, rawValue) {
  const value = String(rawValue ?? "").trim();
  const isEmpty = value === "";

  if (test.value_type === "numeric") {
    if (isEmpty) {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      throw new Error(
        `مقدار آزمایش «${test.name_fa || test.name || test.internal_code}» باید عددی باشد.`,
      );
    }

    if (numeric < 0 && !test.allows_negative) {
      throw new Error(
        `مقدار منفی برای آزمایش «${test.name_fa || test.name || test.internal_code}» مجاز نیست.`,
      );
    }

    return {
      value_numeric: numeric,
      value_text: null,
      value_boolean: null,
    };
  }

  if (test.value_type === "boolean") {
    if (isEmpty) {
      return null;
    }

    if (value !== "true" && value !== "false") {
      throw new Error(
        `مقدار آزمایش «${test.name_fa || test.name || test.internal_code}» باید true یا false باشد.`,
      );
    }

    return {
      value_numeric: null,
      value_text: null,
      value_boolean: value === "true",
    };
  }

  if (isEmpty) {
    return null;
  }

  return {
    value_numeric: null,
    value_text: value,
    value_boolean: null,
  };
}

function valuesEqual(a, b) {
  return (
    a.value_numeric === b.value_numeric &&
    a.value_text === b.value_text &&
    a.value_boolean === b.value_boolean
  );
}

export async function updateLabOrderStatus(formData) {
  try {
    if (!(formData instanceof FormData)) {
      return fail("اطلاعات درخواست نامعتبر است.");
    }
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی معتبر نیست.");
    }

    const orderId = String(formData.get("order_id") || "").trim();

    const targetStatus = String(formData.get("status") || "").trim();

    if (!orderId || !targetStatus) {
      return fail("اطلاعات وضعیت سفارش ناقص است.");
    }

    const supabase = await createClient();

    const order = await getOwnedOrder(supabase, context.user.id, orderId);

    if (!order) {
      return fail("سفارش پیدا نشد یا متعلق به این آزمایشگاه نیست.");
    }

    if (order.status === targetStatus) {
      return {
        ok: true,
        message: "وضعیت سفارش تغییری نکرد.",
      };
    }

    const allowedTransitions = {
      pending: new Set(["received_by_lab", "cancelled"]),
      received_by_lab: new Set(["in_progress", "cancelled"]),
      in_progress: new Set(["completed", "cancelled"]),
      completed: new Set(),
      cancelled: new Set(),
    };

    if (!allowedTransitions[order.status]?.has(targetStatus)) {
      return fail(`انتقال وضعیت ${order.status} → ${targetStatus} مجاز نیست.`);
    }

    if (targetStatus === "completed") {
      return fail(
        "تکمیل سفارش فقط پس از نهایی‌شدن گزارش آزمایشگاه انجام می‌شود.",
      );
    }

    const update = {
      status: targetStatus,
    };

    if (targetStatus === "received_by_lab") {
      update.received_at = new Date().toISOString();
    }

    if (targetStatus === "cancelled") {
      update.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("lab_orders")
      .update(update)
      .eq("id", order.id)
      .eq("laboratory_id", context.user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/lab/orders");
    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath("/lab/results");

    return {
      ok: true,
      message:
        targetStatus === "received_by_lab"
          ? "سفارش دریافت شد."
          : targetStatus === "in_progress"
            ? "انجام آزمایش شروع شد."
            : "سفارش لغو شد.",
      status: targetStatus,
    };
  } catch (error) {
    console.error("[updateLabOrderStatus]", error);

    return fail("تغییر وضعیت سفارش انجام نشد.");
  }
}

export async function saveLabResults(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) return fail("اطلاعات نتایج معتبر نیست.");
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی معتبر نیست.");
    }

    const orderId = String(formData.get("order_id") || "").trim();

    const requestedReportId = String(formData.get("report_id") || "").trim();

    const shouldFinalize =
      String(formData.get("finalize") || "false") === "true";

    if (!orderId) {
      return fail("شناسه سفارش مشخص نیست.");
    }

    const supabase = await createClient();

    const order = await getOwnedOrder(supabase, context.user.id, orderId);

    if (!order) {
      return fail("سفارش پیدا نشد یا متعلق به این آزمایشگاه نیست.");
    }

    if (order.status !== "in_progress") {
      return fail(
        "ثبت نتیجه فقط وقتی مجاز است که سفارش در وضعیت «در حال انجام» باشد.",
      );
    }

    const tests = await getLabOrderTests(order.id);

    if (!tests.length) {
      return fail("برای این سفارش هیچ آزمایش معتبری تعریف نشده است.");
    }

    let report = null;

    if (requestedReportId) {
      const { data, error } = await supabase
        .from("diagnostic_reports")
        .select("id, lab_order_id, laboratory_id, status")
        .eq("id", requestedReportId)
        .eq("lab_order_id", order.id)
        .eq("laboratory_id", context.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return fail("گزارش پیش‌نویس پیدا نشد.");
      }

      if (data.status !== "draft") {
        return fail("این گزارش دیگر قابل ویرایش نیست.");
      }

      report = data;
    }

    if (!report) {
      const { data, error } = await supabase
        .from("diagnostic_reports")
        .insert({
          lab_order_id: order.id,
          laboratory_id: context.user.id,
          entered_by: context.user.id,
          status: "draft",
        })
        .select("id, lab_order_id, laboratory_id, status")
        .single();

      if (error) {
        throw error;
      }

      report = data;
    }

    const { data: currentObservations, error: observationsError } =
      await supabase
        .from("observations")
        .select(
          "id, test_definition_id, value_numeric, value_text, value_boolean, status, supersedes_observation_id",
        )
        .eq("diagnostic_report_id", report.id);

    if (observationsError) {
      throw observationsError;
    }

    const currentByTest = new Map();

    for (const observation of currentObservations || []) {
      if (observation.status === "preliminary") {
        currentByTest.set(observation.test_definition_id, observation);
      }
    }

    for (const test of tests) {
      let parsed;
      try {
        parsed = parseObservationValue(
          test,
          formData.get(`value_${test.id}`),
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : "مقدار نتیجه معتبر نیست.");
      }

      if (!parsed) {
        const existing = currentByTest.get(test.id);

        if (test.is_required) {
          return fail(
            `نتیجه آزمایش «${test.name_fa || test.name || test.internal_code}» الزامی است.`,
          );
        }

        // If an optional result was previously entered and the lab user
        // clears it, supersede the old preliminary observation instead of
        // silently leaving the old value active.
        if (existing) {
          const { error: supersedeError } = await supabase
            .from("observations")
            .update({
              status: "superseded",
            })
            .eq("id", existing.id)
            .eq("diagnostic_report_id", report.id);

          if (supersedeError) {
            throw supersedeError;
          }
        }

        continue;
      }

      const existing = currentByTest.get(test.id);

      if (existing) {
        const existingValue = {
          value_numeric: existing.value_numeric,
          value_text: existing.value_text,
          value_boolean: existing.value_boolean,
        };

        if (valuesEqual(existingValue, parsed)) {
          continue;
        }

        const { error: supersedeError } = await supabase
          .from("observations")
          .update({
            status: "superseded",
          })
          .eq("id", existing.id)
          .eq("diagnostic_report_id", report.id);

        if (supersedeError) {
          throw supersedeError;
        }
      }

      const { error: insertError } = await supabase
        .from("observations")
        .insert({
          diagnostic_report_id: report.id,
          test_definition_id: test.id,
          value_numeric: parsed.value_numeric,
          value_text: parsed.value_text,
          value_boolean: parsed.value_boolean,
          unit: test.default_unit,
          reference_range_template_id: null,
          reference_min: null,
          reference_max: null,
          reference_text: null,
          flag: "normal",
          status: "preliminary",
          supersedes_observation_id: existing?.id || null,
          entered_by: context.user.id,
        });

      if (insertError) {
        throw insertError;
      }
    }

    if (shouldFinalize) {
      const { data: finalizedReportId, error: finalizeError } =
        await supabase.rpc("finalize_lab_report", {
          p_report_id: report.id,
        });

      if (finalizeError) {
        console.error("[saveLabResults:finalize]", finalizeError);
        return fail("نهایی‌سازی گزارش آزمایش انجام نشد.");
      }

      revalidatePath("/lab/orders");
      revalidatePath(`/lab/orders/${order.id}`);
      revalidatePath("/lab/results");
      revalidatePath(`/lab/results/${report.id}`);

      return {
        ok: true,
        message: "نتایج ثبت و گزارش نهایی شد؛ سفارش نیز به وضعیت تکمیل رسید.",
        reportId: finalizedReportId || report.id,
        finalized: true,
      };
    }

    revalidatePath(`/lab/orders/${order.id}`);
    revalidatePath(`/lab/orders/${order.id}/results/new`);
    revalidatePath("/lab/results");

    return {
      ok: true,
      message: "پیش‌نویس نتایج ذخیره شد.",
      reportId: report.id,
      finalized: false,
    };
  } catch (error) {
    console.error("[saveLabResults]", error);

    return fail("ثبت نتایج آزمایش انجام نشد.");
  }
}

export async function correctLabResult(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) return fail("اطلاعات اصلاح نتیجه معتبر نیست.");
    const context = await getLaboratoryContext();

    if (!context) {
      return fail("دسترسی معتبر نیست.");
    }

    const reportId = String(formData.get("report_id") || "").trim();

    const observationId = String(formData.get("observation_id") || "").trim();

    const rawValue = String(formData.get("value") || "").trim();

    if (!reportId || !observationId || rawValue === "") {
      return fail("اطلاعات اصلاح نتیجه ناقص است.");
    }

    const supabase = await createClient();

    const { data: report, error: reportError } = await supabase
      .from("diagnostic_reports")
      .select("id, lab_order_id, laboratory_id, status")
      .eq("id", reportId)
      .eq("laboratory_id", context.user.id)
      .maybeSingle();

    if (reportError) {
      throw reportError;
    }

    if (!report) {
      return fail("گزارش پیدا نشد.");
    }

    if (!["final", "amended"].includes(report.status)) {
      return fail("اصلاح نتیجه فقط برای گزارش نهایی یا اصلاح‌شده مجاز است.");
    }

    const { data: observation, error: observationError } = await supabase
      .from("observations")
      .select(
        "id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, status",
      )
      .eq("id", observationId)
      .eq("diagnostic_report_id", report.id)
      .in("status", ["final", "corrected"])
      .maybeSingle();

    if (observationError) {
      throw observationError;
    }

    if (!observation) {
      return fail("نتیجه قابل اصلاح پیدا نشد.");
    }

    const { data: test, error: testError } = await supabase
      .from("test_definitions")
      .select("id, name, name_fa, internal_code, value_type, allows_negative")
      .eq("id", observation.test_definition_id)
      .maybeSingle();

    if (testError) {
      throw testError;
    }

    if (!test) {
      return fail("تعریف آزمایش پیدا نشد.");
    }

    let parsed;
    try {
      parsed = parseObservationValue(
        {
          ...test,
          is_required: true,
        },
        rawValue,
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : "مقدار اصلاحی معتبر نیست.");
    }

    if (!parsed) {
      return fail("مقدار اصلاحی الزامی است.");
    }

    const { data: newObservationId, error: correctionError } =
      await supabase.rpc("correct_lab_observation", {
        p_report_id: report.id,
        p_observation_id: observation.id,
        p_value_numeric: parsed.value_numeric,
        p_value_text: parsed.value_text,
        p_value_boolean: parsed.value_boolean,
      });

    if (correctionError) {
      console.error("[correctLabResult:rpc]", correctionError);
      return fail("اصلاح نتیجه آزمایش انجام نشد.");
    }

    revalidatePath(`/lab/results/${report.id}`);
    revalidatePath(`/lab/results/${report.id}/correct`);
    revalidatePath("/lab/results");

    return {
      ok: true,
      message: "نتیجه با حفظ سابقه اصلاح شد.",
      observationId: newObservationId,
    };
  } catch (error) {
    console.error("[correctLabResult]", error);

    return fail("اصلاح نتیجه آزمایش انجام نشد.");
  }
}
