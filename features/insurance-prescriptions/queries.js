import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { requireCenter } from "@/features/centers/queries";
import { requirePatient } from "@/features/patient/auth";
import { getSessionUser } from "@/lib/auth/server";

const REFERRAL_STATUSES = new Set([
  "assigned",
  "accepted",
  "in_progress",
  "partially_completed",
  "completed",
  "result_submitted",
  "finalized",
]);

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLimit(value, fallback = 50, max = 100) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
}

function hasMoreWorklistPage(result, offset, rawItems, pageSize) {
  const total = Number(result?.data?.total);
  if (Number.isFinite(total) && total >= 0) {
    // The database worklist is scoped to every active membership of the user.
    // Center/generic workspaces may then filter out other provider kinds, so
    // pagination must use the raw page count rather than the visible item count.
    return total > offset + rawItems.length;
  }
  return rawItems.length === pageSize && offset < 10000;
}

export async function getAdminInsuranceWorkspace(options = {}) {
  await requireAdmin();

  const page = Math.min(501, Math.max(1, Number.parseInt(options.page, 10) || 1));
  const identityPageSize = 20;
  const routingPageSize = 20;
  const identityOffset = (page - 1) * identityPageSize;
  const routingOffset = (page - 1) * routingPageSize;
  const userDb = await createClient();
  const adminDb = createAdminClient();

  const [openReviewResult, inReviewResult, needsInfoResult, prescriptionsResult, providersResult, servicesResult, mappingsResult, connectionsResult] =
    await Promise.all([
      userDb.rpc("pas_get_insurance_identity_review_queue", {
        p_status: "open",
        p_limit: identityPageSize,
        p_offset: identityOffset,
      }),
      userDb.rpc("pas_get_insurance_identity_review_queue", {
        p_status: "in_review",
        p_limit: identityPageSize,
        p_offset: identityOffset,
      }),
      userDb.rpc("pas_get_insurance_identity_review_queue", {
        p_status: "needs_information",
        p_limit: identityPageSize,
        p_offset: identityOffset,
      }),
      adminDb
        .from("pas_insurance_prescriptions")
        .select(
          "id,payer_key,external_prescription_id,external_tracking_number,source_message_version,source_received_at,issued_at,expires_at,patient_id,status,identity_match_status",
          { count: "exact" },
        )
        .in("status", ["ready_for_routing", "partially_routed"])
        .order("source_received_at", { ascending: false })
        .range(routingOffset, routingOffset + routingPageSize - 1),
      adminDb
        .from("pas_provider_registry")
        .select("id,provider_kind,display_name,legal_name,license_number,status")
        .eq("status", "active")
        .order("display_name")
        .limit(200),
      adminDb
        .from("pas_service_catalog")
        .select("id,service_code,service_group,service_kind,allowed_provider_kind,display_name")
        .eq("is_active", true)
        .order("service_group")
        .order("display_name"),
      adminDb
        .from("pas_insurance_item_mappings")
        .select(
          "id,payer_key,external_code_system,external_code,external_display,service_catalog_id,valid_from,valid_until,mapping_version,is_active",
        )
        .eq("is_active", true)
        .order("payer_key")
        .order("external_code")
        .limit(500),
      adminDb
        .from("pas_integration_connections")
        .select("provider_key,enabled")
        .in("provider_key", ["tamin", "ihio", "armed_forces"]),
    ]);

  for (const result of [openReviewResult, inReviewResult, needsInfoResult, prescriptionsResult, providersResult, servicesResult, mappingsResult, connectionsResult]) {
    if (result.error) throw result.error;
  }

  const prescriptions = normalizeRows(prescriptionsResult.data);
  const prescriptionIds = prescriptions.map((item) => item.id);
  const providerIds = normalizeRows(providersResult.data).map((provider) => provider.id);

  const [
    itemsResult,
    assignmentsResult,
    assignedItemsResult,
    capabilitiesResult,
    patientProfilesResult,
    membershipsResult,
  ] = await Promise.all([
      prescriptionIds.length
        ? adminDb
            .from("pas_insurance_prescription_items")
            .select(
              "id,prescription_id,external_item_id,line_number,item_kind,external_code_system,external_code,external_display,service_catalog_id,mapping_status,quantity,unit_label,item_status",
            )
            .in("prescription_id", prescriptionIds)
            .eq("item_status", "active")
            .order("line_number")
        : Promise.resolve({ data: [], error: null }),
      prescriptionIds.length
        ? adminDb
            .from("pas_execution_referrals")
            .select("id,prescription_id,provider_id,status")
            .in("prescription_id", prescriptionIds)
        : Promise.resolve({ data: [], error: null }),
      prescriptionIds.length
        ? adminDb
            .from("pas_execution_referral_items")
            .select("prescription_item_id,referral_id")
            .in("prescription_id", prescriptionIds)
        : Promise.resolve({ data: [], error: null }),
      providerIds.length
        ? adminDb
            .from("pas_provider_capabilities")
            .select("provider_id,service_catalog_id,is_active,valid_from,valid_until")
            .in("provider_id", providerIds)
            .order("valid_from", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      prescriptions.some((item) => item.patient_id)
        ? adminDb
            .from("profiles")
            .select("id,full_name")
            .in(
              "id",
              prescriptions.map((item) => item.patient_id).filter(Boolean),
            )
        : Promise.resolve({ data: [], error: null }),
      providerIds.length
        ? adminDb
            .from("pas_provider_memberships")
            .select("id,provider_id,profile_id,role_in_provider,status,external_actor_reference,created_at")
            .in("provider_id", providerIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [itemsResult, assignmentsResult, assignedItemsResult, capabilitiesResult, patientProfilesResult, membershipsResult]) {
    if (result.error) throw result.error;
  }

  const servicesById = new Map(
    normalizeRows(servicesResult.data).map((service) => [service.id, service]),
  );
  const patientProfilesById = new Map(
    normalizeRows(patientProfilesResult.data).map((profile) => [profile.id, profile]),
  );
  const memberProfileIds = [...new Set(normalizeRows(membershipsResult.data).map((membership) => membership.profile_id))];
  const memberProfilesResult = memberProfileIds.length
    ? await adminDb.from("profiles").select("id,full_name,phone,role").in("id", memberProfileIds)
    : { data: [], error: null };
  if (memberProfilesResult.error) throw memberProfilesResult.error;
  const memberProfilesById = new Map(
    normalizeRows(memberProfilesResult.data).map((profile) => [profile.id, profile]),
  );
  const itemsByPrescription = new Map();
  for (const item of normalizeRows(itemsResult.data)) {
    const rows = itemsByPrescription.get(item.prescription_id) || [];
    rows.push({ ...item, service: servicesById.get(item.service_catalog_id) || null });
    itemsByPrescription.set(item.prescription_id, rows);
  }

  const referralsByPrescription = new Map();
  const referralsById = new Map();
  for (const referral of normalizeRows(assignmentsResult.data)) {
    referralsById.set(referral.id, referral);
    const rows = referralsByPrescription.get(referral.prescription_id) || [];
    rows.push({
      ...referral,
      provider: normalizeRows(providersResult.data).find((provider) => provider.id === referral.provider_id) || null,
    });
    referralsByPrescription.set(referral.prescription_id, rows);
  }

  const capabilitiesByProvider = new Map();
  for (const capability of normalizeRows(capabilitiesResult.data)) {
    const rows = capabilitiesByProvider.get(capability.provider_id) || [];
    rows.push(capability);
    capabilitiesByProvider.set(capability.provider_id, rows);
  }

  const membershipsByProvider = new Map();
  for (const membership of normalizeRows(membershipsResult.data)) {
    const rows = membershipsByProvider.get(membership.provider_id) || [];
    rows.push({
      ...membership,
      profile: memberProfilesById.get(membership.profile_id) || null,
    });
    membershipsByProvider.set(membership.provider_id, rows);
  }

  const providers = normalizeRows(providersResult.data).map((provider) => {
    const capabilityRecords = (capabilitiesByProvider.get(provider.id) || []).map((capability) => ({
      ...capability,
      service: servicesById.get(capability.service_catalog_id) || null,
    }));
    const now = Date.now();
    return {
      ...provider,
      capabilityRecords,
      members: membershipsByProvider.get(provider.id) || [],
      capabilities: capabilityRecords
        .filter((capability) =>
          capability.is_active &&
          (!capability.valid_from || new Date(capability.valid_from).getTime() <= now) &&
          (!capability.valid_until || new Date(capability.valid_until).getTime() > now),
        )
        .map((capability) => capability.service_catalog_id),
    };
  });

  const assignedReferralByItem = new Map(
    normalizeRows(assignedItemsResult.data).map((assignment) => [
      assignment.prescription_item_id,
      referralsById.get(assignment.referral_id) || null,
    ]),
  );

  const now = Date.now();
  const readyPrescriptions = prescriptions.map((prescription) => {
    const { patient_id: patientId, ...safePrescription } = prescription;
    const expiresAt = prescription.expires_at ? Date.parse(prescription.expires_at) : null;
    return {
      ...safePrescription,
      is_expired: Number.isFinite(expiresAt) && expiresAt <= now,
      patient_name: patientProfilesById.get(patientId)?.full_name || null,
      items: (itemsByPrescription.get(prescription.id) || []).map((item) => ({
        ...item,
        assignedReferral: assignedReferralByItem.get(item.id) || null,
      })),
      referrals: referralsByPrescription.get(prescription.id) || [],
    };
  });

  const identityReviews = [
    ...normalizeRows(openReviewResult.data?.items),
    ...normalizeRows(inReviewResult.data?.items),
    ...normalizeRows(needsInfoResult.data?.items),
  ]
    .map((review) => ({
      review_id: review.review_id,
      review_status: review.review_status,
      review_reason: review.review_reason,
      review_created_at: review.review_created_at,
      prescription: {
        id: review.prescription?.id,
        payer_key: review.prescription?.payer_key,
        external_prescription_id: review.prescription?.external_prescription_id,
        external_tracking_number: review.prescription?.external_tracking_number,
        source_message_version: review.prescription?.source_message_version,
        source_received_at: review.prescription?.source_received_at,
        issued_at: review.prescription?.issued_at,
        expires_at: review.prescription?.expires_at,
        status: review.prescription?.status,
        item_count: review.prescription?.item_count,
        unmapped_item_count: review.prescription?.unmapped_item_count,
      },
      items: normalizeRows(review.items).map((item) => ({
        id: item.id,
        external_item_id: item.external_item_id,
        line_number: item.line_number,
        item_kind: item.item_kind,
        external_code_system: item.external_code_system,
        external_code: item.external_code,
        display: item.display,
        mapping_status: item.mapping_status,
        quantity: item.quantity,
        unit: item.unit,
      })),
    }))
    .sort((a, b) => new Date(b.review_created_at || 0) - new Date(a.review_created_at || 0));

  return {
    identityReviews,
    identityReviewTotal: Number(openReviewResult.data?.total || 0) + Number(inReviewResult.data?.total || 0) + Number(needsInfoResult.data?.total || 0),
    identityReviewPageCount: Math.max(
      1,
      Math.ceil(Number(openReviewResult.data?.total || 0) / identityPageSize),
      Math.ceil(Number(inReviewResult.data?.total || 0) / identityPageSize),
      Math.ceil(Number(needsInfoResult.data?.total || 0) / identityPageSize),
    ),
    readyPrescriptionTotal: Number(prescriptionsResult.count || 0),
    routingPageCount: Math.max(1, Math.ceil(Number(prescriptionsResult.count || 0) / routingPageSize)),
    page,
    readyPrescriptions,
    providers,
    serviceCatalog: normalizeRows(servicesResult.data),
    mappings: normalizeRows(mappingsResult.data).map((mapping) => ({
      ...mapping,
      service: servicesById.get(mapping.service_catalog_id) || null,
    })),
    insurerConnections: normalizeRows(connectionsResult.data),
  };
}

async function getCenterProviderContext(type) {
  const user = await requireCenter(type);
  const db = await createClient();
  const membershipResult = await db
    .from("pas_provider_memberships")
    .select("provider_id,role_in_provider,status")
    .eq("profile_id", user.id)
    .eq("status", "active");

  if (membershipResult.error) throw membershipResult.error;
  const memberships = normalizeRows(membershipResult.data);
  const memberProviderIds = [...new Set(memberships.map((membership) => membership.provider_id))];
  if (!memberProviderIds.length) {
    return { user, db, providers: [], memberships: [], operatorProviderIds: [] };
  }

  const providersResult = await db
    .from("pas_provider_registry")
    .select("id,provider_kind,display_name,medical_center_profile_id,status")
    .in("id", memberProviderIds)
    .eq("status", "active");
  if (providersResult.error) throw providersResult.error;

  const providers = normalizeRows(providersResult.data).filter(
    (provider) =>
      provider.provider_kind === "medical_center" &&
      provider.medical_center_profile_id === user.id,
  );
  const providerIds = new Set(providers.map((provider) => provider.id));
  const scopedMemberships = memberships.filter((membership) => providerIds.has(membership.provider_id));
  const operatorProviderIds = scopedMemberships
    .filter((membership) => ["owner", "manager", "operator"].includes(membership.role_in_provider))
    .map((membership) => membership.provider_id);

  return { user, db, providers, memberships: scopedMemberships, operatorProviderIds };
}

async function attachSubmittedResultSummaries(referrals) {
  if (!referrals.length) return referrals;
  const referralIds = referrals.map((referral) => referral.referral_id);
  // The authenticated worklist RPC has already scoped these IDs to the current
  // provider membership. The service client reads metadata only, never result
  // payloads or patient details, because the result table is intentionally RPC-only.
  const adminDb = createAdminClient();
  const result = await adminDb
    .from("pas_referral_results")
    .select("id,referral_id,provider_id,status,version_number,received_at,submitted_at")
    .in("referral_id", referralIds)
    .eq("status", "submitted")
    .order("received_at", { ascending: false })
    .limit(100);
  if (result.error) throw result.error;

  const byReferral = new Map();
  for (const row of normalizeRows(result.data)) {
    const rows = byReferral.get(row.referral_id) || [];
    rows.push({
      result_id: row.id,
      provider_id: row.provider_id,
      version_number: row.version_number,
      submitted_at: row.submitted_at || row.received_at,
    });
    byReferral.set(row.referral_id, rows);
  }

  return referrals.map((referral) => ({
    ...referral,
    submittedResults: (byReferral.get(referral.referral_id) || [])
      .filter((row) => row.provider_id === referral.provider_id)
      .map(({ provider_id: _providerId, ...row }) => row),
  }));
}

export async function getCenterProviderReferrals(type, options = {}) {
  const context = await getCenterProviderContext(type);
  const requestedStatus = typeof options.status === "string" ? options.status : null;
  const status = requestedStatus && REFERRAL_STATUSES.has(requestedStatus) ? requestedStatus : null;
  const page = Math.min(501, Math.max(1, Number.parseInt(options.page, 10) || 1));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  if (!context.providers.length) {
    return {
      user: context.user,
      provider: null,
      referrals: [],
      canMutate: false,
      status,
      page,
      pageOffset: offset,
      hasMore: false,
      message: "برای این حساب، عضویت فعال مرکز در فهرست ارائه‌دهندگان خدمات ثبت نشده است.",
    };
  }

  const result = await context.db.rpc("pas_provider_referral_worklist", {
    p_status: status,
    p_limit: pageSize,
    p_offset: offset,
  });
  if (result.error) throw result.error;

  const providerById = new Map(context.providers.map((provider) => [provider.id, provider]));
  const rawReferrals = normalizeRows(result.data?.items);
  const referrals = await attachSubmittedResultSummaries(
    rawReferrals
      .filter((referral) => providerById.has(referral.provider_id))
      .map((referral) => ({
        ...referral,
        provider: providerById.get(referral.provider_id),
        items: normalizeRows(referral.items),
      })),
  );

  return {
    user: context.user,
    provider: context.providers[0],
    providers: context.providers,
    referrals,
    canMutate: context.operatorProviderIds.length > 0,
    operatorProviderIds: context.operatorProviderIds,
    status,
    page,
    pageOffset: offset,
    hasMore: hasMoreWorklistPage(result, offset, rawReferrals, pageSize),
    message: null,
  };
}


const getProviderMembershipDetails = cache(async (profileId) => {
  const db = await createClient();
  const membershipResult = await db
    .from("pas_provider_memberships")
    .select("provider_id,role_in_provider,status")
    .eq("profile_id", profileId)
    .eq("status", "active");

  if (membershipResult.error) throw membershipResult.error;
  const memberships = normalizeRows(membershipResult.data);
  const providerIds = [...new Set(memberships.map((membership) => membership.provider_id))];
  if (!providerIds.length) return { db, providers: [], memberships: [], operatorProviderIds: [], allowedProviderIds: new Set() };

  const providerResult = await db
    .from("pas_provider_registry")
    .select("id,provider_kind,display_name,medical_center_profile_id,status")
    .in("id", providerIds)
    .eq("status", "active");

  if (providerResult.error) throw providerResult.error;
  const providers = normalizeRows(providerResult.data).filter((provider) =>
    ["medical_center", "pharmacy", "other"].includes(provider.provider_kind),
  );
  const allowedProviderIds = new Set(providers.map((provider) => provider.id));
  const scopedMemberships = memberships.filter((membership) => allowedProviderIds.has(membership.provider_id));
  const operatorProviderIds = scopedMemberships
    .filter((membership) => ["owner", "manager", "operator"].includes(membership.role_in_provider))
    .map((membership) => membership.provider_id);

  return { db, providers, memberships: scopedMemberships, operatorProviderIds, allowedProviderIds };
});

function isOwnCenterAccount(user, provider) {
  return provider.provider_kind === "medical_center" &&
    provider.medical_center_profile_id === user.id &&
    ["laboratory", "medical_center"].includes(user.role);
}

const getGenericProviderContext = cache(async () => {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role === "patient") notFound();
  const details = await getProviderMembershipDetails(user.id);
  // A center's own account continues using its center-specific workspace. Staff
  // accounts (doctor/admin/etc.) use the provider workspace, regardless of
  // profiles.role, because provider membership is the actual authorization.
  const workspaceProviders = details.providers.filter((provider) => !isOwnCenterAccount(user, provider));
  if (!workspaceProviders.length) notFound();
  const allowedProviderIds = new Set(workspaceProviders.map((provider) => provider.id));
  const memberships = details.memberships.filter((membership) => allowedProviderIds.has(membership.provider_id));
  const operatorProviderIds = memberships
    .filter((membership) => ["owner", "manager", "operator"].includes(membership.role_in_provider))
    .map((membership) => membership.provider_id);
  return {
    user,
    db: details.db,
    providers: workspaceProviders,
    memberships,
    operatorProviderIds,
    allowedProviderIds,
  };
});

export async function getProviderWorkspaceNavigationUser(user) {
  if (!user?.id || user.role === "patient") return user;
  const details = await getProviderMembershipDetails(user.id);
  const workspaceProviders = details.providers.filter((provider) => !isOwnCenterAccount(user, provider));
  if (!workspaceProviders.length) return user;
  const kinds = [...new Set(workspaceProviders.map((provider) => provider.provider_kind))];
  const providerKind = kinds.length === 1 ? kinds[0] : "mixed";
  const label = providerKind === "medical_center"
    ? "مرکز درمانی"
    : providerKind === "pharmacy"
      ? "داروخانه"
      : providerKind === "other"
        ? "ارائه‌دهنده خدمت"
        : "ارائه‌دهنده خدمات";
  return {
    ...user,
    provider_workspace: true,
    provider_workspace_kind: providerKind,
    provider_workspace_label: label,
  };
}

export async function getGenericProviderWorkspaceUser() {
  const context = await getGenericProviderContext();
  return getProviderWorkspaceNavigationUser(context.user);
}

export async function getGenericProviderMembershipScope() {
  const context = await getGenericProviderContext();
  return {
    userId: context.user.id,
    providers: context.providers,
    operatorProviderIds: context.operatorProviderIds,
  };
}

export async function getProviderMembershipWorklistForScope(options = {}) {
  const context = await getGenericProviderContext();
  const status = typeof options.status === "string" && REFERRAL_STATUSES.has(options.status)
    ? options.status
    : null;
  const limit = normalizeLimit(options.limit, 20, 100);
  const offset = Math.min(Math.max(Number.parseInt(options.offset, 10) || 0, 0), 10000);
  const result = await context.db.rpc("pas_provider_referral_worklist", {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });

  if (result.error) throw result.error;
  return normalizeRows(result.data?.items).filter((item) => context.allowedProviderIds.has(item.provider_id));
}

export async function getGenericProviderReferrals(options = {}) {
  const context = await getGenericProviderContext();
  const requestedStatus = typeof options.status === "string" ? options.status : null;
  const status = requestedStatus && REFERRAL_STATUSES.has(requestedStatus) ? requestedStatus : null;
  const page = Math.min(501, Math.max(1, Number.parseInt(options.page, 10) || 1));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const result = await context.db.rpc("pas_provider_referral_worklist", {
    p_status: status,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (result.error) throw result.error;
  const providerById = new Map(context.providers.map((provider) => [provider.id, provider]));
  const rawReferrals = normalizeRows(result.data?.items);
  const referrals = await attachSubmittedResultSummaries(
    rawReferrals
      .filter((referral) => providerById.has(referral.provider_id))
      .map((referral) => ({
        ...referral,
        provider: providerById.get(referral.provider_id),
        items: normalizeRows(referral.items),
      })),
  );

  return {
    user: context.user,
    providers: context.providers,
    referrals,
    operatorProviderIds: context.operatorProviderIds,
    status,
    page,
    pageOffset: offset,
    hasMore: hasMoreWorklistPage(result, offset, rawReferrals, pageSize),
    message: null,
  };
}


export async function getPatientInsurancePrescriptions(options = {}) {
  await requirePatient();
  const limit = normalizeLimit(options.limit, 30, 50);
  const offset = Math.min(Math.max(Number.parseInt(options.offset, 10) || 0, 0), 10000);
  const db = await createClient();
  const result = await db.rpc("pas_get_patient_insurance_prescriptions", {
    p_limit: limit,
    p_offset: offset,
  });

  if (result.error) {
    // Keep the rest of the patient prescriptions page available while the
    // backend RPC is deployed or its PostgREST schema cache is refreshed.
    if (result.error.code === "PGRST202") {
      console.error(
        "[Patient Insurance Prescriptions] Required RPC is unavailable",
        result.error,
      );
      return {
        total: 0,
        limit,
        offset,
        items: [],
        unavailable: true,
      };
    }

    throw result.error;
  }

  return {
    total: Number(result.data?.total || 0),
    limit: Number(result.data?.limit || limit),
    offset: Number(result.data?.offset || offset),
    items: normalizeRows(result.data?.items),
    unavailable: false,
  };
}

export async function getDoctorPatientInsurancePrescriptions(patientId, options = {}) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) notFound();
  const id = typeof patientId === "string" ? patientId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { scope_available: false, total: 0, items: [] };
  }

  const db = await createClient();
  const result = await db.rpc("pas_get_doctor_patient_insurance_prescriptions", {
    p_patient_id: id,
    p_limit: normalizeLimit(options.limit, 10, 20),
    p_offset: Math.min(Math.max(Number.parseInt(options.offset, 10) || 0, 0), 10000),
  });
  if (result.error) {
    if (result.error.code === "42501" || result.error.code === "P0002") {
      return { scope_available: false, total: 0, items: [] };
    }
    // Do not fall back to the patient-scoped RPC: it has a different security
    // boundary. Keep the physician record usable while the doctor RPC is deployed
    // or PostgREST refreshes its schema cache.
    if (result.error.code === "PGRST202") {
      console.error("[Doctor Insurance Prescriptions] Physician RPC is unavailable in the database schema cache.");
      return { scope_available: false, unavailable: true, total: 0, items: [] };
    }
    throw result.error;
  }
  return {
    scope_available: result.data?.scope_available === true,
    total: Number(result.data?.total || 0),
    limit: Number(result.data?.limit || 10),
    offset: Number(result.data?.offset || 0),
    items: normalizeRows(result.data?.items),
  };
}

export async function getDoctorInsuranceReferralResultDetail(resultId) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) notFound();
  const id = typeof resultId === "string" ? resultId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const db = await createClient();
  const result = await db.rpc("pas_get_doctor_insurance_result_detail", { p_result_id: id });
  if (result.error) {
    if (["P0002", "42501"].includes(result.error.code)) return null;
    throw result.error;
  }
  const data = result.data;
  if (!data) return null;
  return {
    result_id: data.result_id,
    result_kind: data.result_kind,
    version_number: data.version_number,
    performed_at: data.performed_at,
    finalized_at: data.finalized_at,
    provider: data.provider || null,
    laboratory_values: normalizeRows(data.laboratory_values),
    imaging_report: data.imaging_report || null,
    pharmacy_dispenses: normalizeRows(data.pharmacy_dispenses),
    service_results: normalizeRows(data.service_results),
  };
}

export async function getPatientInsuranceReferralResults(limit = 50) {
  await requirePatient();
  const db = await createClient();
  const result = await db.rpc("pas_get_patient_final_results", {
    p_limit: normalizeLimit(limit, 50),
  });
  if (result.error) throw result.error;
  return normalizeRows(result.data?.items).map((item) => ({
    result_id: item.result_id,
    result_kind: item.result_kind,
    version_number: item.version_number,
    performed_at: item.performed_at,
    finalized_at: item.finalized_at,
    provider: item.provider ? {
      display_name: item.provider.display_name,
      provider_kind: item.provider.provider_kind,
    } : null,
  }));
}

export async function getPatientInsuranceReferralResultDetail(resultId) {
  await requirePatient();
  const id = typeof resultId === "string" ? resultId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const db = await createClient();
  const result = await db.rpc("pas_get_patient_final_result_detail", { p_result_id: id });
  if (result.error) {
    if (result.error.code === "P0002") return null;
    throw result.error;
  }

  const data = result.data;
  if (!data) return null;
  return {
    result_id: data.result_id,
    result_kind: data.result_kind,
    version_number: data.version_number,
    performed_at: data.performed_at,
    finalized_at: data.finalized_at,
    provider: data.provider ? {
      display_name: data.provider.display_name,
      provider_kind: data.provider.provider_kind,
    } : null,
    laboratory_values: normalizeRows(data.laboratory_values).filter((value) => value.value_status !== "superseded").map((value) => ({
      test_name: value.test_name,
      test_name_fa: value.test_name_fa,
      value_numeric: value.value_numeric,
      value_text: value.value_text,
      value_boolean: value.value_boolean,
      unit: value.unit,
      reference_min: value.reference_min,
      reference_max: value.reference_max,
      reference_text: value.reference_text,
      abnormal_flag: value.abnormal_flag,
      value_status: value.value_status,
      observed_at: value.observed_at,
    })),
    imaging_report: data.imaging_report ? {
      report_text: data.imaging_report.report_text,
      findings: data.imaging_report.findings,
      impression: data.imaging_report.impression,
      images_available: data.imaging_report.images_available,
    } : null,
    pharmacy_dispenses: normalizeRows(data.pharmacy_dispenses).map((item) => ({
      item: item.item,
      dispense_status: item.dispense_status,
      prescribed_quantity: item.prescribed_quantity,
      dispensed_quantity: item.dispensed_quantity,
      substitute_display: item.substitute_display,
      not_dispensed_reason: item.not_dispensed_reason,
      dispensed_at: item.dispensed_at,
    })),
    service_results: normalizeRows(data.service_results).map((item) => ({
      service_group: item.service_group,
      data: item.data,
    })),
  };
}

export async function getProviderWorklistForScope(type, options = {}) {
  const context = await getCenterProviderContext(type);
  const status = typeof options.status === "string" && REFERRAL_STATUSES.has(options.status)
    ? options.status
    : null;
  const result = await context.db.rpc("pas_provider_referral_worklist", {
    p_status: status,
    p_limit: normalizeLimit(options.limit, 20),
    p_offset: Math.min(Math.max(Number.parseInt(options.offset, 10) || 0, 0), 10000),
  });
  if (result.error) throw result.error;
  const allowedProviderIds = new Set(context.providers.map((provider) => provider.id));
  return normalizeRows(result.data?.items).filter((item) => allowedProviderIds.has(item.provider_id));
}
