import "server-only";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function getProviderReferralWorklist({ status = null, limit = 20, offset = 0 } = {}) {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("UNAUTHENTICATED");
  const db = await createClient();
  const { data, error } = await db.rpc("pas_provider_referral_worklist", {
    p_status: status,
    p_limit: Math.max(1, Math.min(Number.parseInt(limit, 10) || 20, 100)),
    p_offset: Math.max(0, Math.min(Number.parseInt(offset, 10) || 0, 10000)),
  });
  if (error) {
    if (error.code === "42501") throw new Error("PROVIDER_MEMBERSHIP_REQUIRED");
    console.error("[provider referral worklist]", { code: error.code });
    throw new Error("PROVIDER_WORKLIST_UNAVAILABLE");
  }
  return { user, ...(data ?? { total: 0, items: [] }) };
}

export async function getProviderIntegrationContext() {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("UNAUTHENTICATED");
  const db = await createClient();
  const { data, error } = await db
    .from("pas_provider_memberships")
    .select("provider_id,role_in_provider,status,provider:pas_provider_registry(id,provider_kind,display_name,status)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(20);
  if (error) {
    console.error("[provider integration context]", { code: error.code });
    throw new Error("PROVIDER_CONTEXT_UNAVAILABLE");
  }
  return { user, providers: data ?? [] };
}
