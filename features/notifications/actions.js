"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const notificationPathByRole = {
  patient: "/patient/notifications",
  doctor: "/doctor/notifications",
  laboratory: "/lab/notifications",
};

export async function markNotificationRead(formData) {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false };
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("notifications")
    .update({ status: "read", is_read: true })
    .eq("id", id)
    .eq("recipient_id", user.id)
    .eq("is_read", false)
    .select("id");

  if (error) throw error;

  if (notificationPathByRole[user.role]) revalidatePath(notificationPathByRole[user.role]);
  return { ok: true, changed: Boolean(updated?.length) };
}

export async function markNotificationReviewed(formData) {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false };
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("notifications")
    .update({ status: "reviewed" })
    .eq("id", id)
    .eq("recipient_id", user.id)
    .neq("status", "reviewed")
    .select("id");
  if (error) throw error;

  if (notificationPathByRole[user.role]) revalidatePath(notificationPathByRole[user.role]);
  return { ok: true, changed: Boolean(updated?.length) };
}

export async function markAllNotificationsRead() {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("notifications")
    .update({ status: "read", is_read: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false)
    .select("id");

  if (error) throw error;

  if (notificationPathByRole[user.role]) revalidatePath(notificationPathByRole[user.role]);
  return { ok: true, changed: Boolean(updated?.length), count: updated?.length ?? 0 };
}
