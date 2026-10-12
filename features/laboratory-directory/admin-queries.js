import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

export async function getAdminLaboratoryOrganizations() {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_laboratory_organizations");
  if (error) {
    console.error("[getAdminLaboratoryOrganizations]", error);
    throw new Error("فهرست سازمان‌های آزمایشگاهی دریافت نشد.");
  }
  return data || [];
}

export async function getAdminLaboratoryBranches(organizationId = null) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_laboratory_branches", {
    p_organization_id: organizationId,
  });
  if (error) {
    console.error("[getAdminLaboratoryBranches]", error);
    throw new Error("فهرست شعب آزمایشگاه دریافت نشد.");
  }
  return data || [];
}

export async function getAdminLaboratoryBranchMembers(branchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin" || !isUuid(branchId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_laboratory_branch_members", {
    p_branch_id: branchId,
  });
  if (error) {
    console.error("[getAdminLaboratoryBranchMembers]", error);
    throw new Error("فهرست اعضای شعبه دریافت نشد.");
  }
  return data || [];
}

/** Returns existing laboratory accounts only; only admins may call this query. */
export async function getAdminLaboratoryAccountChoices(organizationId = null) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin") return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("laboratory_profiles")
    .select("id, license_number, organization_id")
    .order("license_number", { ascending: true });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    console.error("[getAdminLaboratoryAccountChoices:profiles]", error);
    throw new Error("فهرست حساب‌های آزمایشگاه دریافت نشد.");
  }
  if (!data?.length) return [];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", data.map((row) => row.id));
  if (profilesError) {
    console.error("[getAdminLaboratoryAccountChoices:identity]", profilesError);
    throw new Error("اطلاعات حساب‌های آزمایشگاه دریافت نشد.");
  }
  const identity = new Map((profiles || []).map((row) => [row.id, row]));
  return data.map((row) => ({ ...row, full_name: identity.get(row.id)?.full_name, phone: identity.get(row.id)?.phone }));
}
