import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const statuses = ["assigned", "accepted", "in_progress", "partially_completed", "completed", "result_submitted", "finalized", "rejected", "cancelled"];
const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
};
const reply = (body, status) => Response.json(body, { status, headers: PRIVATE_NO_STORE_HEADERS });
export async function GET(request) {
  const user = await getSessionUser();
  if (!user?.id) return reply({ error: "UNAUTHENTICATED" }, 401);
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  if (rawStatus && !z.enum(statuses).safeParse(rawStatus).success) {
    return reply({ error: "INVALID_STATUS_FILTER" }, 400);
  }
  const db = await createClient();
  const { data, error } = await db.rpc("pas_provider_referral_worklist", {
    p_status: rawStatus || null,
    p_limit: Math.max(1, Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 20, 100)),
    p_offset: Math.max(0, Math.min(Number.isFinite(parsedOffset) ? parsedOffset : 0, 10000)),
  });
  if (error) {
    if (error.code === "42501") return reply({ error: "PROVIDER_MEMBERSHIP_REQUIRED" }, 403);
    console.error("[provider referral list]", { code: error.code });
    return reply({ error: "WORKLIST_UNAVAILABLE" }, 503);
  }
  return reply(data ?? { total: 0, items: [] }, 200);
}
