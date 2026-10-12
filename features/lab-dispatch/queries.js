import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const VALID_DISPATCH_STATUSES = new Set(["pending", "accepted", "rejected", "cancelled"]);
const VALID_HOME_STATUSES = new Set(["requested", "approved", "rejected", "scheduled", "dispatched", "collected", "cancelled"]);

export async function getLabIncomingDispatches({ status = "pending", limit = 50 } = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory") return [];
  if (status !== "all" && !VALID_DISPATCH_STATUSES.has(status)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lab_dispatch_queue", {
    p_status: status,
    p_limit: Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50)),
  });
  if (error) {
    console.error("[getLabIncomingDispatches]", error);
    throw new Error("فهرست درخواست‌های آزمایشگاه دریافت نشد.");
  }
  return Array.isArray(data) ? data : [];
}

export async function getLabHomeCollectionQueue({ status = "requested", limit = 50 } = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory") return [];
  if (status !== "all" && !VALID_HOME_STATUSES.has(status)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lab_home_collection_queue", {
    p_status: status,
    p_limit: Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50)),
  });
  if (error) {
    console.error("[getLabHomeCollectionQueue]", error);
    throw new Error("فهرست درخواست‌های نمونه‌گیری در منزل دریافت نشد.");
  }
  return Array.isArray(data) ? data : [];
}

export async function getMyLabDispatches() {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_dispatches")
    .select("id, physician_lab_request_id, laboratory_branch_id, status, requested_home_collection, sent_at, responded_at, response_note, lab_order_id, created_at")
    .eq("created_by", user.id)
    .order("sent_at", { ascending: false });
  if (error) throw error;

  const branchIds = [...new Set((data || []).map((row) => row.laboratory_branch_id).filter(Boolean))];
  const { data: branches, error: branchesError } = branchIds.length
    ? await supabase.from("laboratory_branches").select("id, display_name, city, address, supports_home_collection").in("id", branchIds)
    : { data: [], error: null };
  if (branchesError) throw branchesError;
  const branchMap = new Map((branches || []).map((row) => [row.id, row]));

  return (data || []).map((dispatch) => ({
    ...dispatch,
    branch: branchMap.get(dispatch.laboratory_branch_id) || null,
  }));
}

export async function getPatientHomeCollectionRequests() {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_collection_requests")
    .select("id, physician_lab_request_id, lab_dispatch_id, laboratory_branch_id, lab_order_id, status, requested_at, approved_at, rejected_at, scheduled_for, dispatched_at, collected_at, cancelled_at, rejection_reason, collection_note, created_at, updated_at")
    .eq("patient_id", user.id)
    .order("requested_at", { ascending: false });
  if (error) throw error;

  const branchIds = [...new Set((data || []).map((row) => row.laboratory_branch_id).filter(Boolean))];
  const { data: branches, error: branchError } = branchIds.length
    ? await supabase.from("laboratory_branches").select("id, display_name, city, address, supports_home_collection").in("id", branchIds)
    : { data: [], error: null };
  if (branchError) throw branchError;
  const branchMap = new Map((branches || []).map((row) => [row.id, row]));

  return (data || []).map((request) => ({
    ...request,
    branch: branchMap.get(request.laboratory_branch_id) || null,
  }));
}
