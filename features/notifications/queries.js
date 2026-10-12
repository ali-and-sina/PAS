import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requirePatient } from "@/features/patient/auth";
import { DEFAULT_PAGE_SIZE, makePagination, normalizePage, normalizePageSize } from "@/lib/pagination";

const NOTIFICATION_SELECT =
  "id, type, title, body, related_entity_type, related_entity_id, status, is_read, created_at, reviewed_at, reviewed_by";

async function getUnreadCount(supabase, recipientId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function getDoctorNotifications(doctorId, { page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  if (!doctorId) return { items: [], pagination: makePagination({ page: 1, pageSize: requestedPageSize, totalCount: 0 }) };

  const supabase = await createClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  const makeQuery = () => supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .eq("recipient_id", doctorId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw result.error;
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }

  const notifications = result.data || [];
  const pagination = makePagination({ page, pageSize, totalCount });
  const unreadCount = await getUnreadCount(supabase, doctorId);
  if (!notifications.length) return { items: [], pagination, unreadCount };

  // Resolve only entity IDs on the visible page, using caller-scoped RLS.
  const entityIds = (type) => [...new Set(notifications
    .filter((row) => row.related_entity_type === type && row.related_entity_id)
    .map((row) => row.related_entity_id))];
  const visitIds = entityIds("visit");
  const voiceNoteIds = entityIds("voice_note");
  const noteIds = entityIds("doctor_note");

  const [visitsResult, voiceNotesResult, notesResult] = await Promise.all([
    visitIds.length
      ? supabase.from("visits").select("id, patient_id").eq("doctor_id", doctorId).in("id", visitIds)
      : Promise.resolve({ data: [], error: null }),
    voiceNoteIds.length
      ? supabase.from("voice_notes").select("id, patient_id").eq("doctor_id", doctorId).is("archived_at", null).in("id", voiceNoteIds)
      : Promise.resolve({ data: [], error: null }),
    noteIds.length
      ? supabase.from("doctor_notes").select("id, patient_id").eq("doctor_id", doctorId).in("id", noteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (visitsResult.error) throw visitsResult.error;
  if (voiceNotesResult.error) throw voiceNotesResult.error;
  if (notesResult.error) throw notesResult.error;

  const patientByEntity = new Map();
  for (const row of visitsResult.data || []) patientByEntity.set(`visit:${row.id}`, row.patient_id);
  for (const row of voiceNotesResult.data || []) patientByEntity.set(`voice_note:${row.id}`, row.patient_id);
  for (const row of notesResult.data || []) patientByEntity.set(`doctor_note:${row.id}`, row.patient_id);

  return {
    items: notifications.map((notification) => ({
      ...notification,
      relatedPatientId: patientByEntity.get(`${notification.related_entity_type}:${notification.related_entity_id}`) || null,
    })),
    pagination,
    unreadCount,
  };
}

export async function getPatientNotifications({ page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const context = await requirePatient();
  const patientId = context.patient_id;
  const supabase = await createClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  const makeQuery = () => supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .eq("recipient_id", patientId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw result.error;
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }

  const unreadCount = await getUnreadCount(supabase, patientId);
  return {
    items: (result.data || []).map((notification) => ({ ...notification, message: notification.body })),
    pagination: makePagination({ page, pageSize, totalCount }),
    unreadCount,
  };
}

export async function getLaboratoryNotifications(laboratoryId, { page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  if (!laboratoryId) return { items: [], pagination: makePagination({ page: 1, pageSize: requestedPageSize, totalCount: 0 }) };

  const supabase = await createClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  const makeQuery = () => supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .eq("recipient_id", laboratoryId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw result.error;
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }

  const unreadCount = await getUnreadCount(supabase, laboratoryId);
  return {
    items: result.data || [],
    pagination: makePagination({ page, pageSize, totalCount }),
    unreadCount,
  };
}

