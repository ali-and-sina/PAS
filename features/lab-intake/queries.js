import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

export async function getLabIntakeDetails(dispatchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(dispatchId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lab_dispatch_details", {
    p_dispatch_id: dispatchId,
  });
  if (error) {
    if (error.code === "P0001") return null;
    throw error;
  }
  return data || null;
}

export async function getHomeCollectionPrivateDetails(homeCollectionRequestId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(homeCollectionRequestId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_home_collection_private_details", {
    p_home_collection_request_id: homeCollectionRequestId,
  });
  if (error) {
    if (error.code === "P0001") return null;
    throw error;
  }
  return data || null;
}
