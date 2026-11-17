import "server-only";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function getMyPublishedInsuranceResults(limit = 50) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") throw new Error("PATIENT_AUTHENTICATION_REQUIRED");
  const db = await createClient();
  const { data, error } = await db.rpc("pas_get_patient_final_results", {
    p_limit: Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100)),
  });
  if (error) {
    if (error.code === "42501") throw new Error("PATIENT_ACCESS_FORBIDDEN");
    console.error("[patient published insurance results]", { code: error.code });
    throw new Error("PATIENT_RESULTS_UNAVAILABLE");
  }
  return data?.items ?? [];
}
