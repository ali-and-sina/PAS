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
  try {
    if (!(formData instanceof FormData)) return { ok: false };

    const user = await getSessionUser();
    if (!user?.id) return { ok: false };

    const id = String(formData.get("id") || "").trim();
    if (!id) return { ok: false };

    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("recipient_id", user.id);

    if (error) {
      console.error("[markNotificationRead]", error);
      return { ok: false };
    }

    if (notificationPathByRole[user.role]) {
      revalidatePath(notificationPathByRole[user.role]);
    }

    return { ok: true };
  } catch (error) {
    console.error("[markNotificationRead]", error);
    return { ok: false };
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await getSessionUser();
    if (!user?.id) return { ok: false };

    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("[markAllNotificationsRead]", error);
      return { ok: false };
    }

    if (notificationPathByRole[user.role]) {
      revalidatePath(notificationPathByRole[user.role]);
    }

    return { ok: true };
  } catch (error) {
    console.error("[markAllNotificationsRead]", error);
    return { ok: false };
  }
}
