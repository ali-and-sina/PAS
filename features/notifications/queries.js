import "server-only";

import { createClient } from "@/lib/supabase/server";

async function getNotifications(recipientId) {
  if (!recipientId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, related_entity_type, related_entity_id, is_read, created_at",
    )
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((notification) => ({
    ...notification,
    message: notification.body,
  }));
}

export async function getPatientNotifications(patientId) {
  return getNotifications(patientId);
}

export async function getDoctorNotifications(doctorId) {
  return getNotifications(doctorId);
}

export async function getLaboratoryNotifications(laboratoryId) {
  return getNotifications(laboratoryId);
}
