import "server-only";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

function unwrap(row) {
  if (Array.isArray(row)) return row[0] ?? null;
  return row ?? null;
}

export async function getAdminOverview() {
  await requireAdmin();
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

export async function getAdminUsers({ role = "all", search = "" } = {}) {
  await requireAdmin();
  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        phone,
        role,
        created_at,
        doctor_profiles (
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
    )
    .order("created_at", { ascending: false });

  if (["patient", "doctor", "laboratory", "admin"].includes(role)) {
    query = query.eq("role", role);
  }

  const normalizedSearch = String(search ?? "").trim();
  if (normalizedSearch) {
    const escaped = normalizedSearch.replace(/[%_,]/g, (char) => `\\${char}`);
    query = query.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAdminUsers]", error);
    throw new Error("ADMIN_USERS_FAILED");
  }

  return (data ?? []).map((row) => {
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
}

export async function getAdminDoctors({ status = "all" } = {}) {
  await requireAdmin();
  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        phone,
        created_at,
        doctor_profiles!doctor_profiles_id_fkey (
          medical_license_number,
          specialty,
          is_verified,
          verified_at,
          verified_by,
          created_at
        )
      `,
    )
    .eq("role", "doctor")
    .order("created_at", { ascending: false });

  if (status === "pending") {
    query = query.eq("doctor_profiles.is_verified", false);
  }

  if (status === "verified") {
    query = query.eq("doctor_profiles.is_verified", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAdminDoctors]", error);
    throw new Error("ADMIN_DOCTORS_FAILED");
  }

  return (data ?? [])
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
        verified_by: doctor.verified_by,
        doctor_created_at: doctor.created_at,
      };
    })
    .filter(Boolean);
}

export async function getAdminLaboratories() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
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
          created_at,
          organizations (
            id,
            name,
            type,
            license_number
          )
        )
      `,
    )
    .eq("role", "laboratory")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getAdminLaboratories]", error);
    throw new Error("ADMIN_LABORATORIES_FAILED");
  }

  return (data ?? [])
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
        laboratory_created_at: laboratory.created_at,
        organization: unwrap(laboratory.organizations),
      };
    })
    .filter(Boolean);
}


export async function getAdminDoctor(doctorId) {
  await requireAdmin();
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
      doctor_profiles!doctor_profiles_id_fkey (
        medical_license_number,
        specialty,
        is_verified,
        verified_at,
        verified_by,
        created_at
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
    doctor_created_at: doctor.created_at,
  };
}

export async function getAdminLaboratory(laboratoryId) {
  await requireAdmin();
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
        created_at,
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
    laboratory_created_at: laboratory.created_at,
    organization: unwrap(laboratory.organizations),
  };
}

export async function getAdminUser(userId) {
  await requireAdmin();
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
      doctor_profiles (
        medical_license_number,
        specialty,
        is_verified,
        verified_at
      ),
      laboratory_profiles (
        license_number,
        organization_id,
        created_at,
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
