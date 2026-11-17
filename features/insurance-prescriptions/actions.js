"use server";

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { requirePatient } from "@/features/patient/auth";
import { requireCenter } from "@/features/centers/queries";
import { createClient } from "@/lib/supabase/server";
import { getNationalIdSearchVariants, normalizeDigits } from "@/lib/utils/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProviderMembershipWorklistForScope,
  getProviderWorklistForScope,
  getGenericProviderMembershipScope,
} from "@/features/insurance-prescriptions/queries";

const UUID = z.string().uuid();
const PAYER_KEYS = ["tamin", "ihio", "armed_forces"];

function failure(message, code = "OPERATION_FAILED") {
  return { ok: false, code, message };
}

function success(data = {}) {
  return { ok: true, ...data };
}

function normalizeText(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toActionError(error) {
  const code = error?.code || "OPERATION_FAILED";
  const messages = {
    "42501": "برای انجام این کار دسترسی لازم را ندارید.",
    "22023": "اطلاعات ارسالی معتبر نیست.",
    "23514": "این تغییر با وضعیت فعلی ارجاع سازگار نیست.",
    "23505": "این مورد قبلاً ثبت شده یا با یک ارجاع دیگر تداخل دارد.",
    "23503": "مرکز، خدمت یا حساب انتخاب‌شده پیدا نشد.",
    "22007": "تاریخ واردشده معتبر نیست.",
    P0002: "مورد درخواستی پیدا نشد یا دیگر در دسترس نیست.",
  };
  return failure(messages[code] || "عملیات انجام نشد. دوباره تلاش کنید.", code);
}

function escapeLike(value) {
  return value.replace(/[\\%_,]/g, "\\$&");
}

function isValidDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function searchInsurancePatientCandidates(value) {
  await requireAdmin();
  const query = normalizeText(value, 80);
  if (query.length < 2) return success({ items: [] });

  try {
    const db = createAdminClient();
    const safe = escapeLike(query);
    const normalizedDigits = normalizeDigits(query).replace(/\D/g, "");
    const nationalIdVariants = getNationalIdSearchVariants(query);
    const [byName, byPhone, byNationalId] = await Promise.all([
      db.from("profiles")
        .select("id,full_name,phone")
        .eq("role", "patient")
        .ilike("full_name", `%${safe}%`)
        .order("full_name")
        .limit(8),
      db.from("profiles")
        .select("id,full_name,phone")
        .eq("role", "patient")
        .or([...new Set([`phone.ilike.%${safe}%`, ...(normalizedDigits ? [`phone.ilike.%${normalizedDigits}%`] : [])])].join(","))
        .order("full_name")
        .limit(8),
      nationalIdVariants.length
        ? db.from("profiles")
            .select("id,full_name,phone")
            .eq("role", "patient")
            .or(nationalIdVariants.map((term) => `national_id.ilike.%${term}%`).join(","))
            .order("full_name")
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (byName.error) throw byName.error;
    if (byPhone.error) throw byPhone.error;
    if (byNationalId.error) throw byNationalId.error;

    const unique = new Map();
    for (const item of [...(byName.data || []), ...(byPhone.data || []), ...(byNationalId.data || [])]) unique.set(item.id, item);
    const candidates = [...unique.values()].slice(0, 16);
    if (!candidates.length) return success({ items: [] });
    const patientProfiles = await db.from("patient_profiles").select("id").in("id", candidates.map((item) => item.id));
    if (patientProfiles.error) throw patientProfiles.error;
    const validPatientIds = new Set((patientProfiles.data || []).map((item) => item.id));
    return success({ items: candidates.filter((item) => validPatientIds.has(item.id)).slice(0, 10) });
  } catch (error) {
    console.error("[searchInsurancePatientCandidates]", error);
    return failure("جست‌وجوی بیمار انجام نشد.");
  }
}

export async function searchProviderStaffCandidates(value) {
  await requireAdmin();
  const query = normalizeText(value, 80);
  if (query.length < 2) return success({ items: [] });

  try {
    const db = createAdminClient();
    const safe = escapeLike(query);
    const [byName, byPhone] = await Promise.all([
      db.from("profiles")
        .select("id,full_name,phone,role")
        .neq("role", "patient")
        .ilike("full_name", `%${safe}%`)
        .order("full_name")
        .limit(8),
      db.from("profiles")
        .select("id,full_name,phone,role")
        .neq("role", "patient")
        .ilike("phone", `%${safe}%`)
        .order("full_name")
        .limit(8),
    ]);
    if (byName.error) throw byName.error;
    if (byPhone.error) throw byPhone.error;

    const unique = new Map();
    for (const item of [...(byName.data || []), ...(byPhone.data || [])]) unique.set(item.id, item);
    return success({ items: [...unique.values()].slice(0, 10) });
  } catch (error) {
    console.error("[searchProviderStaffCandidates]", error);
    return failure("جست‌وجوی حساب کاربری انجام نشد.");
  }
}

export async function createGenericProvider(input) {
  await requireAdmin();
  const parsed = z.object({
    providerKind: z.enum(["pharmacy", "other"]),
    displayName: z.string().trim().min(2).max(180),
    legalName: z.string().trim().max(180).optional().default(""),
    licenseNumber: z.string().trim().max(120).optional().default(""),
  }).safeParse(input || {});
  if (!parsed.success) return failure("اطلاعات ارائه‌دهنده معتبر نیست.", "INVALID_INPUT");

  try {
    const db = await createClient();
    const { data, error } = await db.rpc("pas_admin_create_generic_provider_v1", {
      p_provider_kind: parsed.data.providerKind,
      p_display_name: parsed.data.displayName,
      p_legal_name: parsed.data.legalName || null,
      p_license_number: parsed.data.licenseNumber || null,
      p_metadata: {},
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    revalidatePath("/admin");
    return success({ providerId: data });
  } catch (error) {
    console.error("[createGenericProvider]", error);
    return toActionError(error);
  }
}

export async function upsertProviderMembership(input) {
  await requireAdmin();
  const parsed = z.object({
    providerId: UUID,
    profileId: UUID,
    roleInProvider: z.enum(["owner", "manager", "operator", "viewer"]),
    status: z.enum(["active", "inactive", "revoked"]),
    externalActorReference: z.string().trim().max(180).optional().default(""),
  }).safeParse(input || {});
  if (!parsed.success) return failure("اطلاعات عضویت ارائه‌دهنده معتبر نیست.", "INVALID_INPUT");

  try {
    const adminDb = createAdminClient();
    const profileResult = await adminDb
      .from("profiles")
      .select("id,role")
      .eq("id", parsed.data.profileId)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data || profileResult.data.role === "patient") {
      return failure("حساب انتخاب‌شده برای عضویت ارائه‌دهنده مجاز نیست.", "INVALID_PROVIDER_MEMBER");
    }

    const db = await createClient();
    const { data, error } = await db.rpc("pas_admin_set_provider_membership", {
      p_provider_id: parsed.data.providerId,
      p_profile_id: parsed.data.profileId,
      p_role_in_provider: parsed.data.roleInProvider,
      p_status: parsed.data.status,
      p_external_actor_reference: parsed.data.externalActorReference || null,
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    revalidatePath("/provider/referrals");
    return success({ membershipId: data });
  } catch (error) {
    console.error("[upsertProviderMembership]", error);
    return toActionError(error);
  }
}

export async function upsertProviderCapability(input) {
  await requireAdmin();
  const parsed = z.object({
    providerId: UUID,
    serviceCode: z.string().trim().min(1).max(100),
    isActive: z.boolean(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).safeParse(input || {});
  if (!parsed.success || !isValidDateOnly(parsed.data?.validFrom) || (parsed.data?.validUntil && !isValidDateOnly(parsed.data.validUntil))) {
    return failure("تاریخ یا اطلاعات ظرفیت معتبر نیست.", "INVALID_INPUT");
  }
  if (parsed.data.validUntil && parsed.data.validUntil < parsed.data.validFrom) {
    return failure("تاریخ پایان نمی‌تواند قبل از شروع اعتبار باشد.", "INVALID_DATE_RANGE");
  }

  try {
    const db = await createClient();
    const { data, error } = await db.rpc("pas_admin_upsert_provider_capability_v1", {
      p_provider_id: parsed.data.providerId,
      p_service_code: parsed.data.serviceCode,
      p_is_active: parsed.data.isActive,
      p_valid_from: `${parsed.data.validFrom}T00:00:00.000Z`,
      p_valid_until: parsed.data.validUntil ? `${parsed.data.validUntil}T23:59:59.999Z` : null,
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    return success({ data });
  } catch (error) {
    console.error("[upsertProviderCapability]", error);
    return toActionError(error);
  }
}

export async function reviewInsuranceIdentity(input) {
  await requireAdmin();
  const parsed = z.object({
    prescriptionId: UUID,
    decision: z.enum(["approve", "reject"]),
    patientId: UUID.nullable().optional(),
    note: z.string().trim().max(2000).optional().default(""),
  }).safeParse(input || {});
  if (!parsed.success) return failure("اطلاعات بازبینی معتبر نیست.", "INVALID_INPUT");
  if (parsed.data.decision === "approve" && !parsed.data.patientId) {
    return failure("برای تأیید، ابتدا بیمار درست را انتخاب کنید.", "PATIENT_REQUIRED");
  }

  try {
    const db = await createClient();
    const { data, error } = await db.rpc("pas_review_insurance_identity", {
      p_prescription_id: parsed.data.prescriptionId,
      p_decision: parsed.data.decision,
      p_patient_id: parsed.data.decision === "approve" ? parsed.data.patientId : null,
      p_note: parsed.data.note || null,
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    return success({ data });
  } catch (error) {
    console.error("[reviewInsuranceIdentity]", error);
    return toActionError(error);
  }
}

export async function upsertInsuranceItemMapping(input) {
  await requireAdmin();
  const parsed = z.object({
    payerKey: z.enum(PAYER_KEYS),
    itemKind: z.enum(["laboratory", "imaging", "medication", "medical_service", "other"]),
    externalCodeSystem: z.string().trim().min(1).max(100),
    externalCode: z.string().trim().min(1).max(180),
    externalDisplay: z.string().trim().max(240).optional().default(""),
    serviceCode: z.string().trim().min(1).max(100),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).safeParse(input || {});
  if (!parsed.success || !isValidDateOnly(parsed.data?.validFrom) || (parsed.data?.validUntil && !isValidDateOnly(parsed.data.validUntil))) {
    return failure("اطلاعات نگاشت کد یا تاریخ اعتبار معتبر نیست.", "INVALID_INPUT");
  }
  if (parsed.data.validUntil && parsed.data.validUntil < parsed.data.validFrom) {
    return failure("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.", "INVALID_DATE_RANGE");
  }

  try {
    const expectedGroups = {
      laboratory: ["laboratory"],
      imaging: ["imaging"],
      medication: ["medication"],
      medical_service: ["therapy", "other"],
      other: ["other"],
    };
    const adminDb = createAdminClient();
    const serviceResult = await adminDb
      .from("pas_service_catalog")
      .select("service_code,service_group,is_active")
      .eq("service_code", parsed.data.serviceCode)
      .maybeSingle();
    if (serviceResult.error) throw serviceResult.error;
    if (!serviceResult.data?.is_active || !expectedGroups[parsed.data.itemKind]?.includes(serviceResult.data.service_group)) {
      return failure("نوع قلم بیمه با گروه خدمت انتخاب‌شده سازگار نیست.", "ITEM_KIND_MISMATCH");
    }

    const db = await createClient();
    const { data, error } = await db.rpc("pas_admin_upsert_insurance_item_mapping_v1", {
      p_payer_key: parsed.data.payerKey,
      p_external_code_system: parsed.data.externalCodeSystem,
      p_external_code: parsed.data.externalCode,
      p_external_display: parsed.data.externalDisplay || null,
      p_service_code: parsed.data.serviceCode,
      p_valid_from: parsed.data.validFrom,
      p_valid_until: parsed.data.validUntil || null,
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    return success({ data });
  } catch (error) {
    console.error("[upsertInsuranceItemMapping]", error);
    return toActionError(error);
  }
}

export async function routeInsurancePrescription(input) {
  await requireAdmin();
  const parsed = z.object({
    prescriptionId: UUID,
    assignments: z.array(z.object({ item_id: UUID, provider_id: UUID })).min(1).max(500),
  }).safeParse(input || {});
  if (!parsed.success) return failure("برای ارجاع، دست‌کم یک قلم و مرکز معتبر انتخاب کنید.", "INVALID_INPUT");

  const itemIds = parsed.data.assignments.map((item) => item.item_id);
  if (new Set(itemIds).size !== itemIds.length) {
    return failure("هر قلم نسخه فقط می‌تواند به یک مرکز ارجاع شود.", "DUPLICATE_ITEM");
  }

  try {
    // Validate provider-kind compatibility before calling the service-role-only
    // routing RPC. The database repeats capability/assignment checks atomically.
    const adminDb = createAdminClient();
    const providerIds = [...new Set(parsed.data.assignments.map((item) => item.provider_id))];
    const [prescriptionResult, itemsResult, providersResult] = await Promise.all([
      adminDb
        .from("pas_insurance_prescriptions")
        .select("id,status,identity_match_status,expires_at")
        .eq("id", parsed.data.prescriptionId)
        .maybeSingle(),
      adminDb
        .from("pas_insurance_prescription_items")
        .select("id,prescription_id,item_status,mapping_status,service_catalog_id")
        .eq("prescription_id", parsed.data.prescriptionId)
        .in("id", itemIds),
      adminDb
        .from("pas_provider_registry")
        .select("id,provider_kind,status")
        .in("id", providerIds),
    ]);
    if (prescriptionResult.error) throw prescriptionResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (providersResult.error) throw providersResult.error;

    const prescription = prescriptionResult.data;
    if (!prescription) return failure("نسخه بیمه‌ای پیدا نشد.", "PRESCRIPTION_NOT_FOUND");
    if (!["ready_for_routing", "partially_routed"].includes(prescription.status) || prescription.identity_match_status !== "matched") {
      return failure("وضعیت نسخه برای ارجاع آماده نیست.", "PRESCRIPTION_NOT_ROUTEABLE");
    }
    if (prescription.expires_at && Date.parse(prescription.expires_at) <= Date.now()) {
      return failure("مهلت اعتبار این نسخه بیمه‌ای به پایان رسیده است و امکان ارجاع آن وجود ندارد.", "PRESCRIPTION_EXPIRED");
    }

    const itemsById = new Map((itemsResult.data || []).map((item) => [item.id, item]));
    const providersById = new Map((providersResult.data || []).map((provider) => [provider.id, provider]));
    if (itemsById.size !== itemIds.length) return failure("یک یا چند قلم به این نسخه تعلق ندارد.", "ITEM_OUT_OF_SCOPE");
    if (providerIds.some((providerId) => providersById.get(providerId)?.status !== "active")) {
      return failure("یکی از ارائه‌دهندگان انتخاب‌شده فعال نیست.", "PROVIDER_INACTIVE");
    }

    const serviceIds = [...new Set([...itemsById.values()].map((item) => item.service_catalog_id).filter(Boolean))];
    const [servicesResult, capabilitiesResult] = await Promise.all([
      serviceIds.length
        ? adminDb.from("pas_service_catalog")
            .select("id,service_code,allowed_provider_kind,is_active")
            .in("id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
      serviceIds.length && providerIds.length
        ? adminDb.from("pas_provider_capabilities")
            .select("provider_id,service_catalog_id,is_active,valid_from,valid_until")
            .in("provider_id", providerIds)
            .in("service_catalog_id", serviceIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (servicesResult.error) throw servicesResult.error;
    if (capabilitiesResult.error) throw capabilitiesResult.error;

    const servicesById = new Map((servicesResult.data || []).map((service) => [service.id, service]));
    const capabilities = new Set((capabilitiesResult.data || [])
      .filter((capability) =>
        (!capability.valid_from || new Date(capability.valid_from).getTime() <= Date.now()) &&
        (!capability.valid_until || new Date(capability.valid_until).getTime() > Date.now()),
      )
      .map((capability) => `${capability.provider_id}:${capability.service_catalog_id}`));

    for (const assignment of parsed.data.assignments) {
      const item = itemsById.get(assignment.item_id);
      const provider = providersById.get(assignment.provider_id);
      const service = item?.service_catalog_id ? servicesById.get(item.service_catalog_id) : null;
      if (!item || item.item_status !== "active" || item.mapping_status !== "mapped" || !service?.is_active) {
        return failure("یک یا چند قلم هنوز به خدمت استاندارد فعال نگاشت نشده است.", "ITEM_NOT_MAPPED");
      }
      if (provider?.provider_kind !== service.allowed_provider_kind) {
        return failure("نوع ارائه‌دهنده با خدمت انتخاب‌شده سازگار نیست.", "PROVIDER_KIND_MISMATCH");
      }
      if (!capabilities.has(`${assignment.provider_id}:${item.service_catalog_id}`)) {
        return failure("برای ارائه‌دهنده انتخاب‌شده ظرفیت فعال این خدمت ثبت نشده است.", "CAPABILITY_MISSING");
      }
    }

    // This RPC is intentionally service_role-only. It is called server-side only,
    // after requireAdmin has verified both the signed-in admin and admin_profiles.
    const { data, error } = await adminDb.rpc("pas_route_insurance_prescription", {
      p_prescription_id: parsed.data.prescriptionId,
      p_assignments: parsed.data.assignments,
    });
    if (error) throw error;
    revalidatePath("/admin/insurance-prescriptions");
    revalidatePath("/admin");
    return success({ data });
  } catch (error) {
    console.error("[routeInsurancePrescription]", error);
    return toActionError(error);
  }
}

async function assertReferralInScope({ scope, type, referralId, filterStatus = null, expectedStatus = null, pageOffset = 0 }) {
  const worklist = scope === "provider"
    ? await getProviderMembershipWorklistForScope({ limit: 20, offset: pageOffset, status: filterStatus })
    : await getProviderWorklistForScope(type, { limit: 20, offset: pageOffset, status: filterStatus });
  const referral = worklist.find((item) => item.referral_id === referralId);
  if (!referral || (expectedStatus && referral.status !== expectedStatus)) {
    const error = new Error("REFERRAL_OUT_OF_SCOPE_OR_STALE");
    error.code = "42501";
    throw error;
  }
  return referral;
}

function referralWorkspacePaths(scope, type) {
  return scope === "provider" ? ["/provider/referrals"] : [`/center/${type}/referrals`, "/lab/referrals"];
}

export async function respondToProviderReferral(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    referralId: UUID,
    decision: z.enum(["reject", "cancel"]),
    referralStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).optional().default("assigned"),
    filterStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).nullable().optional().default(null),
    pageOffset: z.number().int().min(0).max(10000).optional().default(0),
    note: z.string().trim().max(2000).optional().default(""),
  }).safeParse(input || {});
  if (!parsed.success) return failure("درخواست معتبر نیست.", "INVALID_INPUT");

  try {
    if (parsed.data.scope === "center") {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      await requireCenter(parsed.data.type);
    } else {
      await getGenericProviderMembershipScope();
    }
    await assertReferralInScope({ scope: parsed.data.scope, type: parsed.data.type, referralId: parsed.data.referralId, filterStatus: parsed.data.filterStatus, expectedStatus: parsed.data.referralStatus, pageOffset: parsed.data.pageOffset });
    const db = await createClient();
    const { data, error } = await db.rpc("pas_respond_to_referral", {
      p_referral_id: parsed.data.referralId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note || null,
    });
    if (error) throw error;
    for (const path of referralWorkspacePaths(parsed.data.scope, parsed.data.type)) revalidatePath(path);
    return success({ data });
  } catch (error) {
    console.error("[respondToProviderReferral]", error);
    return toActionError(error);
  }
}

export async function updateProviderReferralItem(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    referralId: UUID,
    referralItemId: UUID,
    referralStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]),
    filterStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).nullable().optional().default(null),
    pageOffset: z.number().int().min(0).max(10000).optional().default(0),
    nextStatus: z.enum(["accepted", "in_progress", "partially_completed", "completed", "cancelled"]),
    completedQuantity: z.number().positive().max(1000000).nullable().optional(),
    note: z.string().trim().max(1000).optional().default(""),
  }).safeParse(input || {});
  if (!parsed.success) return failure("اطلاعات تغییر وضعیت قلم معتبر نیست.", "INVALID_INPUT");

  try {
    if (parsed.data.scope === "center") {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      await requireCenter(parsed.data.type);
    } else {
      await getGenericProviderMembershipScope();
    }
    const referral = await assertReferralInScope({ scope: parsed.data.scope, type: parsed.data.type, referralId: parsed.data.referralId, filterStatus: parsed.data.filterStatus, expectedStatus: parsed.data.referralStatus, pageOffset: parsed.data.pageOffset });
    const item = (referral.items || []).find((candidate) => candidate.referral_item_id === parsed.data.referralItemId);
    if (!item) return failure("قلم انتخاب‌شده متعلق به این ارجاع نیست.", "ITEM_OUT_OF_SCOPE");
    const allowed = {
      assigned: ["accepted"],
      accepted: ["in_progress", "cancelled"],
      in_progress: ["partially_completed", "completed", "cancelled"],
      partially_completed: ["in_progress", "completed", "cancelled"],
    };
    if (!allowed[item.status]?.includes(parsed.data.nextStatus)) {
      return failure("این تغییر با وضعیت فعلی قلم سازگار نیست.", "INVALID_TRANSITION");
    }
    if (item.item_kind === "medication" && ["partially_completed", "completed"].includes(parsed.data.nextStatus)) {
      return failure(
        "مقدار و وضعیت تحویل دارو باید از اتصال یکپارچه داروخانه ثبت شود.",
        "PHARMACY_RESULT_REQUIRED",
      );
    }

    const itemQuantity = Number(item.quantity);
    const currentCompletedQuantity = Number(item.completed_quantity || 0);
    if (parsed.data.nextStatus === "partially_completed") {
      const nextCompletedQuantity = Number(parsed.data.completedQuantity);
      if (!Number.isFinite(nextCompletedQuantity) || nextCompletedQuantity <= currentCompletedQuantity || nextCompletedQuantity >= itemQuantity) {
        return failure("مقدار تکمیل‌شده باید از مقدار قبلی بیشتر و از کل مقدار کمتر باشد.", "INVALID_COMPLETED_QUANTITY");
      }
    }

    const completedQuantity = parsed.data.nextStatus === "completed"
      ? itemQuantity
      : parsed.data.nextStatus === "partially_completed"
        ? Number(parsed.data.completedQuantity)
        : null;
    const db = await createClient();
    const { data, error } = await db.rpc("pas_update_referral_item", {
      p_referral_item_id: parsed.data.referralItemId,
      p_next_status: parsed.data.nextStatus,
      p_completed_quantity: completedQuantity,
      p_note: parsed.data.note || null,
    });
    if (error) throw error;
    for (const path of referralWorkspacePaths(parsed.data.scope, parsed.data.type)) revalidatePath(path);
    return success({ data });
  } catch (error) {
    console.error("[updateProviderReferralItem]", error);
    return toActionError(error);
  }
}

export async function finalizeProviderResult(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    referralId: UUID,
    resultId: UUID,
    referralStatus: z.enum(["result_submitted", "completed"]),
    filterStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).nullable().optional().default(null),
    pageOffset: z.number().int().min(0).max(10000).optional().default(0),
  }).safeParse(input || {});
  if (!parsed.success) return failure("اطلاعات نهایی‌سازی نتیجه معتبر نیست.", "INVALID_INPUT");

  try {
    if (parsed.data.scope === "center") {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      await requireCenter(parsed.data.type);
    } else {
      await getGenericProviderMembershipScope();
    }
    const referral = await assertReferralInScope({
      scope: parsed.data.scope,
      type: parsed.data.type,
      referralId: parsed.data.referralId,
      filterStatus: parsed.data.filterStatus,
      expectedStatus: parsed.data.referralStatus,
      pageOffset: parsed.data.pageOffset,
    });

    // The worklist RPC proves the caller is an active member of this provider.
    // Read only the result metadata for the scoped referral, never its clinical payload.
    const adminDb = createAdminClient();
    const resultLookup = await adminDb
      .from("pas_referral_results")
      .select("id,referral_id,provider_id,status")
      .eq("id", parsed.data.resultId)
      .eq("referral_id", parsed.data.referralId)
      .maybeSingle();
    if (resultLookup.error) throw resultLookup.error;
    const candidate = resultLookup.data;
    if (!candidate || candidate.provider_id !== referral.provider_id || candidate.status !== "submitted") {
      return failure("نتیجه قابل نهایی‌سازی برای این ارجاع پیدا نشد.", "RESULT_OUT_OF_SCOPE");
    }

    const db = await createClient();
    const { data, error } = await db.rpc("pas_finalize_provider_result", {
      p_result_id: parsed.data.resultId,
    });
    if (error) throw error;
    for (const path of referralWorkspacePaths(parsed.data.scope, parsed.data.type)) revalidatePath(path);
    revalidatePath("/patient/results");
    return success({ data });
  } catch (error) {
    console.error("[finalizeProviderResult]", error);
    return toActionError(error);
  }
}


export async function issuePatientReferralQr(input) {
  await requirePatient();
  const parsed = z.object({ referralId: UUID }).safeParse(input || {});
  if (!parsed.success) return failure("ارجاع انتخاب‌شده معتبر نیست.", "INVALID_INPUT");

  try {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const db = await createClient();
    const { data, error } = await db.rpc("pas_patient_issue_referral_qr_token", {
      p_referral_id: parsed.data.referralId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
    if (error) {
      if (error.code === "23514" && /expired/i.test(error.message || "")) {
        return failure("مهلت اعتبار نسخه به پایان رسیده است و امکان صدور کد پذیرش وجود ندارد.", "PRESCRIPTION_EXPIRED");
      }
      throw error;
    }
    revalidatePath("/patient/prescriptions");
    return success({ token, tokenId: data, expiresAt });
  } catch (error) {
    console.error("[issuePatientReferralQr]", error);
    return toActionError(error);
  }
}

export async function revokePatientReferralQr(input) {
  await requirePatient();
  const parsed = z.object({ referralId: UUID }).safeParse(input || {});
  if (!parsed.success) return failure("ارجاع انتخاب‌شده معتبر نیست.", "INVALID_INPUT");

  try {
    const db = await createClient();
    const { data, error } = await db.rpc("pas_patient_revoke_referral_qr_token", {
      p_referral_id: parsed.data.referralId,
    });
    if (error) throw error;
    revalidatePath("/patient/prescriptions");
    return success({ revokedCount: Number(data || 0) });
  } catch (error) {
    console.error("[revokePatientReferralQr]", error);
    return toActionError(error);
  }
}

export async function issueProviderReferralQr(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    referralId: UUID,
    referralStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]),
    filterStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).nullable().optional().default(null),
    pageOffset: z.number().int().min(0).max(10000).optional().default(0),
  }).safeParse(input || {});
  if (!parsed.success) return failure("ارجاع انتخاب‌شده معتبر نیست.", "INVALID_INPUT");

  try {
    if (parsed.data.scope === "center") {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      await requireCenter(parsed.data.type);
    } else {
      await getGenericProviderMembershipScope();
    }
    const referral = await assertReferralInScope({ scope: parsed.data.scope, type: parsed.data.type, referralId: parsed.data.referralId, filterStatus: parsed.data.filterStatus, expectedStatus: parsed.data.referralStatus, pageOffset: parsed.data.pageOffset });
    if (["rejected", "cancelled", "finalized"].includes(referral.status)) {
      return failure("برای این ارجاع امکان صدور کد جدید وجود ندارد.", "TERMINAL_REFERRAL");
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const db = await createClient();
    const { data, error } = await db.rpc("pas_issue_referral_qr_token", {
      p_referral_id: parsed.data.referralId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    for (const path of referralWorkspacePaths(parsed.data.scope, parsed.data.type)) revalidatePath(path);
    // The raw token is returned once for QR rendering. Only its SHA-256 hash is stored.
    return success({ token, tokenId: data, expiresAt });
  } catch (error) {
    if (error?.code === "23514" && /expired/i.test(error.message || "")) {
      return failure("مهلت اعتبار نسخه به پایان رسیده است و امکان صدور کد پذیرش وجود ندارد.", "PRESCRIPTION_EXPIRED");
    }
    console.error("[issueProviderReferralQr]", error);
    return toActionError(error);
  }
}

export async function revokeProviderReferralQr(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    referralId: UUID,
    referralStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]),
    filterStatus: z.enum(["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized"]).nullable().optional().default(null),
    pageOffset: z.number().int().min(0).max(10000).optional().default(0),
  }).safeParse(input || {});
  if (!parsed.success) return failure("ارجاع انتخاب‌شده معتبر نیست.", "INVALID_INPUT");

  try {
    if (parsed.data.scope === "center") {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      await requireCenter(parsed.data.type);
    } else {
      await getGenericProviderMembershipScope();
    }
    await assertReferralInScope({ scope: parsed.data.scope, type: parsed.data.type, referralId: parsed.data.referralId, filterStatus: parsed.data.filterStatus, expectedStatus: parsed.data.referralStatus, pageOffset: parsed.data.pageOffset });
    const db = await createClient();
    const { data, error } = await db.rpc("pas_revoke_referral_qr_token", {
      p_referral_id: parsed.data.referralId,
    });
    if (error) throw error;
    for (const path of referralWorkspacePaths(parsed.data.scope, parsed.data.type)) revalidatePath(path);
    return success({ revokedCount: Number(data || 0) });
  } catch (error) {
    console.error("[revokeProviderReferralQr]", error);
    return toActionError(error);
  }
}

export async function resolveProviderReferralQr(input) {
  const parsed = z.object({
    scope: z.enum(["center", "provider"]).optional().default("center"),
    type: z.string().min(1).max(40).optional(),
    token: z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  }).safeParse(input || {});
  if (!parsed.success) return failure("کد QR معتبر نیست.", "INVALID_TOKEN");

  try {
    let providerIds;
    if (parsed.data.scope === "provider") {
      const context = await getGenericProviderMembershipScope();
      providerIds = new Set(context.providers.map((provider) => provider.id));
    } else {
      if (!parsed.data.type) return failure("نوع مرکز مشخص نشده است.", "INVALID_SCOPE");
      const user = await requireCenter(parsed.data.type);
      const db = await createClient();
      const membershipResult = await db.from("pas_provider_memberships")
        .select("provider_id")
        .eq("profile_id", user.id)
        .eq("status", "active");
      if (membershipResult.error) throw membershipResult.error;
      const ids = [...new Set((membershipResult.data || []).map((row) => row.provider_id))];
      if (!ids.length) return failure("عضویت فعال مرکز پیدا نشد.", "PROVIDER_NOT_FOUND");
      const providerResult = await db
        .from("pas_provider_registry")
        .select("id,medical_center_profile_id,provider_kind,status")
        .in("id", ids)
        .eq("medical_center_profile_id", user.id)
        .eq("provider_kind", "medical_center")
        .eq("status", "active");
      if (providerResult.error) throw providerResult.error;
      providerIds = new Set((providerResult.data || []).map((provider) => provider.id));
      if (!providerIds.size) return failure("عضویت مرکز در فهرست ارائه‌دهندگان خدمات پیدا نشد.", "PROVIDER_NOT_FOUND");
    }

    const db = await createClient();
    const tokenHash = createHash("sha256").update(parsed.data.token, "utf8").digest("hex");
    const { data, error } = await db.rpc("pas_resolve_referral_qr_token", {
      p_token_hash: tokenHash,
    });
    if (error) throw error;
    if (!providerIds.has(data?.provider?.id)) {
      return failure("این کد برای ارائه‌دهنده دیگری صادر شده است.", "QR_WRONG_PROVIDER");
    }

    // Send only the fields required by the receiving staff UI.
    const safeData = {
      referral: data.referral ? {
        id: data.referral.id,
        status: data.referral.status,
        provider_admission_reference: data.referral.provider_admission_reference,
        provider_admission_at: data.referral.provider_admission_at,
        assigned_at: data.referral.assigned_at,
      } : null,
      provider: data.provider ? {
        id: data.provider.id,
        display_name: data.provider.display_name,
        provider_kind: data.provider.provider_kind,
      } : null,
      patient: data.patient ? {
        display_name: data.patient.display_name,
        date_of_birth: data.patient.date_of_birth,
      } : null,
      payer: data.payer ? {
        payer_key: data.payer.payer_key,
        external_tracking_number: data.payer.external_tracking_number,
      } : null,
      items: Array.isArray(data.items) ? data.items.map((item) => ({
        referral_item_id: item.referral_item_id,
        line_number: item.line_number,
        item_kind: item.item_kind,
        display: item.display,
        quantity: item.quantity,
        unit: item.unit,
        status: item.status,
      })) : [],
    };
    return success({ data: safeData });
  } catch (error) {
    console.error("[resolveProviderReferralQr]", error);
    if (error?.code === "42501") {
      return failure("کد پذیرش معتبر نیست، منقضی شده یا به این ارائه‌دهنده تعلق ندارد.", "QR_INVALID_OR_OUT_OF_SCOPE");
    }
    return toActionError(error);
  }
}
