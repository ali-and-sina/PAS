import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requirePatient } from "@/features/patient/auth";
import { requireVerifiedDoctor } from "@/features/doctor/access";
import {
  DEFAULT_PAGE_SIZE,
  getPageBounds,
  makePagination,
  normalizePage,
  normalizePageSize,
} from "@/lib/pagination";

const PRESCRIPTION_FIELDS =
  "id, patient_id, doctor_id, diagnostic_report_id, status, issued_at, created_at";
const PRESCRIPTION_ITEM_FIELDS =
  "id, prescription_id, medication_name, dosage, frequency, duration, instructions, quantity_units, units_per_day, unit_label, as_needed";

async function getPrescriptionPage({ ownerColumn, ownerId, patientId = null, page = 1, pageSize = DEFAULT_PAGE_SIZE, peopleColumn }) {
  const safePageSize = normalizePageSize(pageSize);
  let safePage = normalizePage(page);
  if (!ownerId) {
    return {
      items: [],
      pagination: makePagination({ page: 1, pageSize: safePageSize, totalCount: 0 }),
    };
  }

  const supabase = await createClient();
  const makeQuery = () => {
    let query = supabase
      .from("prescriptions")
      .select(PRESCRIPTION_FIELDS, { count: "exact" })
      .eq(ownerColumn, ownerId);
    if (patientId) query = query.eq("patient_id", patientId);
    return query.order("issued_at", { ascending: false }).order("id", { ascending: false });
  };

  const bounds = getPageBounds(safePage, safePageSize);
  let result = await makeQuery().range(bounds.from, bounds.to);
  if (result.error) throw result.error;

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  if (safePage > totalPages) {
    safePage = totalPages;
    const corrected = getPageBounds(safePage, safePageSize);
    result = await makeQuery().range(corrected.from, corrected.to);
    if (result.error) throw result.error;
  }

  const prescriptions = result.data || [];
  const pagination = makePagination({ page: safePage, pageSize: safePageSize, totalCount });
  if (!prescriptions.length) return { items: [], pagination };

  const personIds = [...new Set(prescriptions.map((row) => row[peopleColumn]).filter(Boolean))];
  const prescriptionIds = prescriptions.map((row) => row.id);

  const [peopleResult, itemsResult] = await Promise.all([
    personIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("prescription_items").select(PRESCRIPTION_ITEM_FIELDS).in("prescription_id", prescriptionIds),
  ]);
  if (peopleResult.error) throw peopleResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const itemIds = (itemsResult.data || []).map(item=>item.id);
  const receipts = itemIds.length ? await supabase.from("pas_medication_dispenses").select("id,prescription_item_id,quantity_units,received_at,source").in("prescription_item_id",itemIds).order("received_at") : {data:[]};
  if(receipts.error) throw receipts.error;
  const peopleById = new Map((peopleResult.data || []).map((person) => [person.id, person]));
  const itemsByPrescription = new Map();
  for (const item of itemsResult.data || []) {
    const rows = itemsByPrescription.get(item.prescription_id) || [];
    rows.push(item);
    itemsByPrescription.set(item.prescription_id, rows);
  }

  return {
    items: prescriptions.map((prescription) => ({
      ...prescription,
      receipts: (receipts.data || []).filter(r=>(itemsByPrescription.get(prescription.id)||[]).some(i=>i.id===r.prescription_item_id)),
      ...(peopleColumn === "patient_id"
        ? { patient_name: peopleById.get(prescription.patient_id)?.full_name || "بیمار", items: itemsByPrescription.get(prescription.id) || [] }
        : { doctor_profiles: peopleById.get(prescription.doctor_id) || null, prescription_items: itemsByPrescription.get(prescription.id) || [] }),
    })),
    pagination,
  };
}

const EXTERNAL_PRESCRIPTION_FIELDS =
  "id, patient_id, provider_key, external_record_id, title, summary, occurred_at, received_at";

async function getExternalPrescriptionPage({
  patientId = null,
  includePatientNames = false,
  page = 1,
  pageSize = 10,
}) {
  const safePageSize = normalizePageSize(pageSize, 10);
  let safePage = normalizePage(page);
  const supabase = await createClient();

  const makeQuery = () => {
    let query = supabase
      .from("pas_external_health_records")
      .select(EXTERNAL_PRESCRIPTION_FIELDS, { count: "exact" })
      .eq("resource_kind", "prescription");

    if (patientId) query = query.eq("patient_id", patientId);

    return query.order("received_at", { ascending: false }).order("id", { ascending: false });
  };

  const bounds = getPageBounds(safePage, safePageSize);
  let result = await makeQuery().range(bounds.from, bounds.to);
  if (result.error) throw result.error;

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  if (safePage > totalPages) {
    safePage = totalPages;
    const corrected = getPageBounds(safePage, safePageSize);
    result = await makeQuery().range(corrected.from, corrected.to);
    if (result.error) throw result.error;
  }

  const records = result.data || [];
  const pagination = makePagination({ page: safePage, pageSize: safePageSize, totalCount });
  if (!records.length) return { items: [], pagination };

  const patientIds = includePatientNames
    ? [...new Set(records.map((record) => record.patient_id).filter(Boolean))]
    : [];
  const peopleResult = patientIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", patientIds)
    : { data: [], error: null };

  if (peopleResult.error) throw peopleResult.error;

  const peopleById = new Map((peopleResult.data || []).map((person) => [person.id, person]));
  return {
    items: records.map((record) => ({
      ...record,
      ...(includePatientNames
        ? { patient_name: peopleById.get(record.patient_id)?.full_name || "بیمار" }
        : {}),
    })),
    pagination,
  };
}

export async function getDoctorExternalPrescriptions(doctorId, options = {}) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id || doctor.id !== doctorId) {
    throw new Error("DOCTOR_ACCESS_DENIED");
  }

  return getExternalPrescriptionPage({
    includePatientNames: true,
    page: options.page,
    pageSize: options.pageSize,
  });
}

export async function getPatientExternalPrescriptions({ page = 1, pageSize = 10 } = {}) {
  const context = await requirePatient();
  return getExternalPrescriptionPage({
    patientId: context.patient_id,
    page,
    pageSize,
  });
}

export async function getDoctorPrescriptions(doctorId, options = {}) {
  return getPrescriptionPage({
    ...options,
    ownerColumn: "doctor_id",
    ownerId: doctorId,
    peopleColumn: "patient_id",
  });
}

export async function getDoctorPatientPrescriptions(doctorId, patientId, options = {}) {
  const result = await getPrescriptionPage({
    ownerColumn: "doctor_id",
    ownerId: doctorId,
    patientId,
    peopleColumn: "patient_id",
    ...options,
  });
  return result.items;
}

export async function getPatientPrescriptions({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const context = await requirePatient();
  return getPrescriptionPage({
    ownerColumn: "patient_id",
    ownerId: context.patient_id,
    peopleColumn: "doctor_id",
    page,
    pageSize,
  });
}
