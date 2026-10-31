import "server-only";

import { redirect } from "next/navigation";
import { AdminAuthorizationError, requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PAGE_SIZE, makePagination, normalizePage, normalizePageSize } from "@/lib/pagination";

function unwrap(row) {
  if (Array.isArray(row)) return row[0] ?? null;
  return row ?? null;
}

async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError &&
        ["ADMIN_UNAUTHENTICATED", "ADMIN_FORBIDDEN"].includes(error.message)) {
      // Pages and layouts can render concurrently. Authorization denial in a
      // page must redirect too, rather than installing a global error state.
      redirect("/unauthorized");
    }
    throw error;
  }
}

export async function getAdminOverview() {
  await requireAdminPage();
  const supabase = createAdminClient();

  const [
    patientsResult,
    doctorsResult,
    laboratoriesResult,
    pendingDoctorsResult,
    verifiedDoctorsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "patient"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "doctor"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "laboratory"),
    supabase.from("doctor_profiles").select("id", { count: "exact", head: true }).eq("is_verified", false),
    supabase.from("doctor_profiles").select("id", { count: "exact", head: true }).eq("is_verified", true),
  ]);

  const errors = [
    patientsResult.error,
    doctorsResult.error,
    laboratoriesResult.error,
    pendingDoctorsResult.error,
    verifiedDoctorsResult.error,
  ].filter(Boolean);

  if (errors.length) {
    console.error("[getAdminOverview]", errors);
    throw new Error("ADMIN_OVERVIEW_FAILED");
  }

  return {
    patients: patientsResult.count ?? 0,
    doctors: doctorsResult.count ?? 0,
    laboratories: laboratoriesResult.count ?? 0,
    pendingDoctors: pendingDoctorsResult.count ?? 0,
    verifiedDoctors: verifiedDoctorsResult.count ?? 0,
  };
}

export async function getAdminUsers({ role = "all", search = "", page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  await requireAdminPage();
  const supabase = createAdminClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  const normalizedSearch = String(search ?? "").trim();

  const makeQuery = () => {
    let query = supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          phone,
          role,
          created_at,
          doctor_profiles!doctor_profiles_id_fkey (
            medical_license_number,
            specialty,
            is_verified
          ),
          laboratory_profiles (
            license_number,
            organization_id
          ),
          patient_profiles (
            id
          )
        `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    if (["patient", "doctor", "laboratory", "admin"].includes(role)) {
      query = query.eq("role", role);
    }

    if (normalizedSearch) {
      const escaped = normalizedSearch.replace(/[%_,]/g, (char) => "\\" + char);
      query = query.or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
    }
    return query;
  };

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) {
    console.error("[getAdminUsers]", result.error);
    throw new Error("ADMIN_USERS_FAILED");
  }

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) {
      console.error("[getAdminUsers:clamp-page]", result.error);
      throw new Error("ADMIN_USERS_FAILED");
    }
  }

  const items = (result.data ?? []).map((row) => {
    const doctor = unwrap(row.doctor_profiles);
    const laboratory = unwrap(row.laboratory_profiles);
    const patient = unwrap(row.patient_profiles);

    return {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      created_at: row.created_at,
      status:
        row.role === "doctor"
          ? doctor?.is_verified
            ? "verified"
            : "pending"
          : row.role === "patient"
            ? patient
              ? "complete"
              : "incomplete"
            : row.role === "laboratory"
              ? laboratory
                ? "active"
                : "incomplete"
              : "active",
    };
  });

  return { items, pagination: makePagination({ page, pageSize, totalCount }) };
}

export async function getAdminDoctors({ status = "all", page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  await requireAdminPage();
  const supabase = createAdminClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);

  const makeQuery = () => {
    let query = supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          phone,
          created_at,
          doctor_profiles!doctor_profiles_id_fkey!inner (
            medical_license_number,
            specialty,
            is_verified,
            verified_at
          )
        `,
        { count: "exact" },
      )
      .eq("role", "doctor")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    if (status === "pending") query = query.eq("doctor_profiles.is_verified", false);
    if (status === "verified") query = query.eq("doctor_profiles.is_verified", true);
    return query;
  };

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) {
    console.error("[getAdminDoctors]", result.error);
    throw new Error("ADMIN_DOCTORS_FAILED");
  }

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) {
      console.error("[getAdminDoctors:clamp-page]", result.error);
      throw new Error("ADMIN_DOCTORS_FAILED");
    }
  }

  const items = (result.data ?? [])
    .map((row) => {
      const doctor = unwrap(row.doctor_profiles);
      if (!doctor) return null;
      return {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        created_at: row.created_at,
        medical_license_number: doctor.medical_license_number,
        specialty: doctor.specialty,
        is_verified: doctor.is_verified,
        verified_at: doctor.verified_at,
      };
    })
    .filter(Boolean);

  return { items, pagination: makePagination({ page, pageSize, totalCount }) };
}

export async function getAdminLaboratories({ page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  await requireAdminPage();
  const supabase = createAdminClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);

  const makeQuery = () => supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        phone,
        created_at,
        laboratory_profiles (
          license_number,
          organization_id,
          organizations (
            id,
            name,
            type,
            license_number
          )
        )
      `,
      { count: "exact" },
    )
    .eq("role", "laboratory")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) {
    console.error("[getAdminLaboratories]", result.error);
    throw new Error("ADMIN_LABORATORIES_FAILED");
  }

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) {
      console.error("[getAdminLaboratories:clamp-page]", result.error);
      throw new Error("ADMIN_LABORATORIES_FAILED");
    }
  }

  const items = (result.data ?? [])
    .map((row) => {
      const laboratory = unwrap(row.laboratory_profiles);
      if (!laboratory) return null;
      return {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        created_at: row.created_at,
        license_number: laboratory.license_number,
        organization_id: laboratory.organization_id,
        organization: unwrap(laboratory.organizations),
      };
    })
    .filter(Boolean);

  return { items, pagination: makePagination({ page, pageSize, totalCount }) };
}

export async function getAdminDoctor(doctorId) {
  await requireAdminPage();
  const id = String(doctorId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      phone,
      created_at,
      doctor_profiles!doctor_profiles_id_fkey!inner (
        medical_license_number,
        specialty,
        is_verified,
        verified_at,
        verified_by
      )
    `)
    .eq("id", id)
    .eq("role", "doctor")
    .maybeSingle();

  if (error) {
    console.error("[getAdminDoctor]", error);
    throw new Error("ADMIN_DOCTOR_FAILED");
  }

  const doctor = unwrap(data?.doctor_profiles);
  if (!data || !doctor) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    phone: data.phone,
    created_at: data.created_at,
    medical_license_number: doctor.medical_license_number,
    specialty: doctor.specialty,
    is_verified: doctor.is_verified,
    verified_at: doctor.verified_at,
    verified_by: doctor.verified_by,
  };
}

export async function getAdminLaboratory(laboratoryId) {
  await requireAdminPage();
  const id = String(laboratoryId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      phone,
      created_at,
      laboratory_profiles (
        license_number,
        organization_id,
        organizations (
          id,
          name,
          type,
          license_number
        )
      )
    `)
    .eq("id", id)
    .eq("role", "laboratory")
    .maybeSingle();

  if (error) {
    console.error("[getAdminLaboratory]", error);
    throw new Error("ADMIN_LABORATORY_FAILED");
  }

  const laboratory = unwrap(data?.laboratory_profiles);
  if (!data || !laboratory) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    phone: data.phone,
    created_at: data.created_at,
    license_number: laboratory.license_number,
    organization_id: laboratory.organization_id,
    organization: unwrap(laboratory.organizations),
  };
}

export async function getAdminUser(userId) {
  await requireAdminPage();
  const id = String(userId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      phone,
      role,
      national_id,
      created_at,
      updated_at,
      doctor_profiles!doctor_profiles_id_fkey (
        medical_license_number,
        specialty,
        is_verified,
        verified_at
      ),
      laboratory_profiles (
        license_number,
        organization_id,
        pas_medical_centers(center_type,display_name,is_active),
        organizations (
          id,
          name,
          type,
          license_number
        )
      ),
      patient_profiles (
        id,
        date_of_birth,
        sex,
        blood_type
      ),
      admin_profiles (
        personnel_code,
        created_at
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getAdminUser]", error);
    throw new Error("ADMIN_USER_FAILED");
  }

  if (!data) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    phone: data.phone,
    role: data.role,
    national_id: data.national_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    doctor: unwrap(data.doctor_profiles),
    laboratory: unwrap(data.laboratory_profiles),
    patient: unwrap(data.patient_profiles),
    admin: unwrap(data.admin_profiles),
  };
}
