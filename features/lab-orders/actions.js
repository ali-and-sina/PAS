"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDoctorPatient } from "@/features/patients/queries";
import { requireVerifiedDoctor } from "@/features/doctor/access";

function fail(message) {
  return {
    ok: false,
    message,
  };
}

export async function createLabOrder(_previousState, formData) {
  let createdOrderId = null;

  try {
    const doctor = await requireVerifiedDoctor();

    if (!doctor) {
      return fail("دسترسی معتبر نیست.");
    }

    if (!(formData instanceof FormData)) {
      return fail("اطلاعات درخواست نامعتبر است.");
    }

    const patientId = String(formData.get("patient_id") || "").trim();
    const laboratoryId = String(formData.get("laboratory_id") || "").trim();
    const testPanelId = String(formData.get("test_panel_id") || "").trim();
    const clinicalNote = String(formData.get("clinical_note") || "").trim();

    if (!patientId || !laboratoryId || !testPanelId) {
      return fail("بیمار، آزمایشگاه و نوع آزمایش را انتخاب کنید.");
    }

    const patient = await getDoctorPatient(doctor.id, patientId);
    if (!patient) return fail("این بیمار در فهرست بیماران شما نیست.");

    const supabase = await createClient();

    const { data: lab, error: labError } = await supabase
      .from("laboratory_profiles")
      .select("id")
      .eq("id", laboratoryId)
      .maybeSingle();

    if (labError) throw labError;
    if (!lab) return fail("آزمایشگاه انتخاب‌شده معتبر نیست.");

    const { data: panel, error: panelError } = await supabase
      .from("test_panels")
      .select("id")
      .eq("id", testPanelId)
      .eq("is_active", true)
      .maybeSingle();

    if (panelError) throw panelError;
    if (!panel) return fail("نوع آزمایش انتخاب‌شده معتبر نیست.");

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .insert({
        patient_id: patientId,
        doctor_id: doctor.id,
        laboratory_id: laboratoryId,
        status: "pending",
        clinical_note: clinicalNote || null,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;
    createdOrderId = order.id;

    const { error: itemError } = await supabase
      .from("lab_order_items")
      .insert({
        lab_order_id: order.id,
        test_panel_id: testPanelId,
        test_definition_id: null,
      });

    if (itemError) {
      console.error("[createLabOrder:item]", itemError);
      throw itemError;
    }

    revalidatePath("/doctor/lab-orders");
    revalidatePath(`/doctor/patients/${patientId}`);
  } catch (error) {
    console.error("[createLabOrder]", error);

    if (createdOrderId) {
      try {
        const adminClient = createAdminClient();
        const { error: rollbackError } = await adminClient
          .from("lab_orders")
          .delete()
          .eq("id", createdOrderId)
          .eq("status", "pending");

        if (rollbackError) {
          console.error("[createLabOrder:rollback]", rollbackError);
        }
      } catch (rollbackError) {
        console.error("[createLabOrder:rollback]", rollbackError);
      }
    }

    return fail("ایجاد سفارش آزمایش انجام نشد.");
  }

  redirect(`/doctor/lab-orders/${createdOrderId}`);
}
