import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";
const uuidSchema = z.uuid();
const schema = z.object({
  status: z.enum(["accepted", "in_progress", "partially_completed", "completed", "rejected", "cancelled"]),
  completed_quantity: z.number().nonnegative().max(1_000_000).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
}).strict();
const reply = (body, status) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request, { params }) {
  if (!hasSameOrigin(request)) return reply({ error: "INVALID_ORIGIN" }, 403);
  const user = await getSessionUser();
  if (!user?.id) return reply({ error: "UNAUTHENTICATED" }, 401);
  const { referralItemId } = await params;
  if (!uuidSchema.safeParse(referralItemId).success) return reply({ error: "NOT_FOUND" }, 404);
  let input;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "INVALID_INPUT" }, 400);
    input = parsed.data;
  } catch { return reply({ error: "INVALID_JSON" }, 400); }

  const db = await createClient();
  const { data, error } = await db.rpc("pas_update_referral_item", {
    p_referral_item_id: referralItemId,
    p_next_status: input.status,
    p_completed_quantity: input.completed_quantity ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    if (error.code === "42501") return reply({ error: "PROVIDER_FORBIDDEN" }, 403);
    return reply({ error: "REFERRAL_ITEM_TRANSITION_REJECTED" }, 422);
  }
  return reply({ ok: true, ...data }, 200);
}
