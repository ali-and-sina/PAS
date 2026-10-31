import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/auth/admin";
import { dayDate, monthStart, moveMonth, tehranDayKey, tehranDateTimeToISO } from "@/lib/care/dates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unwrap = (r) => { if (r.error) throw r.error; return r.data || []; };
export async function requireCareUser(role) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (role && user.role !== role) redirect("/unauthorized");
  return user;
}
export async function getAccountSettings() {
  const user = await requireCareUser();
  const db = await createClient();
  const [profile, requests, doctor, services] = await Promise.all([
    db.from("profiles").select("id,role,full_name,phone,national_id").eq("id", user.id).single(),
    db.from("pas_identity_requests").select("*").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(10),
    user.role === "doctor" ? db.from("doctor_profiles").select("specialty,medical_license_number").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    Promise.resolve({data: []}),
  ]);
  if (profile.error || doctor.error) throw profile.error || doctor.error;
  return { user, profile: profile.data, requests: unwrap(requests), doctor: doctor.data, services: unwrap(services).map((s) => s.service_kind) };
}
export async function getConsultationsData(role) {
  const user = await requireCareUser(role);
  const db = await createClient();
  const [requests, doctors, availability, voiceConsent] = await Promise.all([
    db.rpc("pas_my_consultations"),
    role === "patient" ? db.rpc("pas_doctor_directory") : Promise.resolve({ data: [] }),
    role === "doctor" ? db.from("pas_doctor_availability").select("*").eq("doctor_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    role === "patient" ? db.from("consents").select("granted_at").eq("patient_id",user.id).eq("consent_type","physician_voice_recording").eq("granted",true).is("revoked_at",null).order("granted_at",{ascending:false}).limit(1).maybeSingle() : Promise.resolve({data:null}),
  ]);
  if (availability.error || voiceConsent.error) throw availability.error || voiceConsent.error;
  return { user, requests: unwrap(requests), doctors: unwrap(doctors), availability: availability.data, voiceConsent: {granted:Boolean(voiceConsent.data),grantedAt:voiceConsent.data?.granted_at||null}, now: new Date().toISOString() };
}
export async function readCalendarEvents(patientId, from, to) {
  const user = await requireCareUser();
  const target = user.role === "patient" ? user.id : patientId;
  if (!["patient", "doctor"].includes(user.role) || !UUID.test(String(target)) ||
      !dayDate(from) || !dayDate(to) || dayDate(to) <= dayDate(from) ||
      dayDate(to) - dayDate(from) > 42 * 86400000) throw new Error("Invalid calendar request");
  const db = await createClient();
  if (user.role === "doctor") {
    const { data } = await db.from("patient_doctor_relationships").select("id")
      .eq("patient_id", target).eq("doctor_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (!data) throw new Error("Patient access denied");
  }
  const start = tehranDateTimeToISO(from);
  const end = tehranDateTimeToISO(to);
  const [visits, orders, reports, followUps, prescriptions, services, external, closures, medicalResults, therapySessions] = await Promise.all([
    db.from("visits").select("id,visit_date,status").eq("patient_id", target).gte("visit_date", start).lt("visit_date", end).limit(500),
    db.from("lab_orders").select("id,ordered_at,status,clinical_note").eq("patient_id", target).gte("ordered_at", start).lt("ordered_at", end).limit(500),
    db.from("diagnostic_reports").select("id,finalized_at,status,lab_orders!inner(patient_id)").eq("lab_orders.patient_id", target).in("status", ["final", "amended"]).gte("finalized_at", start).lt("finalized_at", end).limit(500),
    db.from("follow_ups").select("id,title,description,due_date,status").eq("patient_id", target).gte("due_date", from).lt("due_date", to).limit(500),
    db.from("prescriptions").select("id,issued_at,status").eq("patient_id", target).gte("issued_at", start).lt("issued_at", end).limit(500),
    db.from("pas_medical_requests").select("id,service_name,requested_at,scheduled_at,status,clinical_note").eq("patient_id", target)
      .or("and(requested_at.gte." + start + ",requested_at.lt." + end + "),and(scheduled_at.gte." + start + ",scheduled_at.lt." + end + ")").limit(500),
    db.from("pas_external_health_records").select("id,title,summary,occurred_at,provider_key,resource_kind").eq("patient_id", target).gte("occurred_at", start).lt("occurred_at", end).limit(500),
    db.from("pas_visit_closures").select("visit_id,summary,created_at").eq("patient_id", target).gte("created_at", start).lt("created_at", end).limit(500),
    db.from("pas_medical_results").select("id,conclusion,created_at,pas_medical_requests!inner(patient_id,service_name)").eq("pas_medical_requests.patient_id",target).gte("created_at",start).lt("created_at",end).limit(500),
    db.from("pas_therapy_sessions").select("id,request_id,session_number,occurred_at,progress_note").eq("patient_id",target).gte("occurred_at",start).lt("occurred_at",end).limit(500),
  ]);
  const records = [visits, orders, reports, followUps, prescriptions, services, external, closures, medicalResults, therapySessions].map(unwrap);
  const prefix = user.role === "patient" ? "/patient" : "/doctor";
  const events = [];
  const add = (kind, id, date, title, summary = "", href = null) => {
    const key = tehranDayKey(date);
    if (key && key >= from && key < to) events.push({ id: kind + ":" + id, kind, date, day: key, title, summary, href });
  };
  for (const r of records[0]) add("visit", r.id, r.visit_date, "ویزیت پزشک", r.status === "completed" ? "ویزیت مختومه شده است." : r.status === "cancelled" ? "ویزیت لغو شده است." : "ویزیت برنامه‌ریزی‌شده");
  for (const r of records[1]) add("lab", r.id, r.ordered_at, "درخواست آزمایش", r.clinical_note, prefix + "/medical-services");
  for (const r of records[2]) add("result", r.id, r.finalized_at, "نتیجهٔ آزمایش آماده شد", "", user.role === "patient" ? "/patient/results/" + r.id : "/doctor/patients/" + target);
  for (const r of records[3]) add("follow_up", r.id, r.due_date, r.title, r.description, prefix + "/follow-ups");
  for (const r of records[4]) add("prescription", r.id, r.issued_at, "نسخهٔ پزشک", "", prefix + "/prescriptions");
  for (const r of records[5]) {
    add("diagnostic", r.id, r.scheduled_at || r.requested_at, r.service_name, r.clinical_note, prefix + "/medical-services");

  }
  for (const r of records[6]) add("external", r.id, r.occurred_at, r.title, r.summary);
  for (const r of records[7]) add("summary", r.visit_id, r.created_at, "خلاصهٔ ویزیت", r.summary);
  for (const r of records[8]) add("diagnostic_result",r.id,r.created_at,"گزارش "+r.pas_medical_requests.service_name,r.conclusion,prefix+"/medical-services");
  for (const r of records[9]) add("therapy_session",r.id,r.occurred_at,"جلسهٔ فیزیوتراپی "+new Intl.NumberFormat("fa-IR").format(r.session_number),r.progress_note,prefix+"/medical-services");
  return events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
export async function getCareOverview(patientId) {
  const user = await requireCareUser();
  const target = user.role === "patient" ? user.id : patientId;
  if (!UUID.test(String(target))) throw new Error("Invalid patient");
  const today = tehranDayKey();
  const month = monthStart(today);
  const db = await createClient();
  const [progress, events] = await Promise.all([
    db.rpc("pas_care_progress", { p_patient: target }),
    readCalendarEvents(target, month, moveMonth(month, 1)),
  ]);
  if (progress.error && progress.error.code !== "42501") throw progress.error;
  const grant = user.role === "doctor" ? await db.from("pas_record_access").select("scopes,expires_at").eq("patient_id",target).eq("doctor_id",user.id).maybeSingle() : {data:null};
  if(grant.error) throw grant.error;
  const accessScopes = grant.data && (!grant.data.expires_at || Date.parse(grant.data.expires_at)>Date.now()) ? grant.data.scopes : [];
  return { patientId: target, today, month, events, accessScopes, progress: progress.data || { total: 0, completed: 0, sections: [] }, now: new Date().toISOString() };
}
export async function getMedicalServicesData(role, patientId) {
  const user = await requireCareUser(role);
  const db = await createClient();
  let query = db.from("pas_medical_requests").select("*,pas_medical_results(*),pas_therapy_sessions(*)").order("requested_at", { ascending: false }).limit(100);
  if (role === "patient") query = query.eq("patient_id", user.id);
  if (role === "laboratory") query = query.eq("provider_id", user.id);
  if (role === "doctor" && UUID.test(String(patientId))) query = query.eq("patient_id", patientId);
  const [requestsResult, providersResult] = await Promise.all([query, db.rpc("pas_service_providers")]);
  const requests = unwrap(requestsResult);
  const providers = unwrap(providersResult);

  if (role !== "doctor" || !requests.length) {
    return { user, requests, providers };
  }

  const patientIds = [...new Set(requests.map((request) => request.patient_id).filter(Boolean))];
  const profilesResult = patientIds.length
    ? await db.from("profiles").select("id, full_name").eq("role", "patient").in("id", patientIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;

  const patientNames = new Map((profilesResult.data || []).map((profile) => [profile.id, profile.full_name]));
  return {
    user,
    requests: requests.map((request) => ({
      ...request,
      patient_name: patientNames.get(request.patient_id) || "بیمار",
    })),
    providers,
  };
}
export async function getPharmacyRequests(role) {
  const user = await requireCareUser(role);
  if (role === "admin") await requireAdmin();
  const db = await createClient();
  let query = db.from("pas_pharmacy_requests").select("*").order("created_at", { ascending: false }).limit(100);
  if (role === "patient") query = query.eq("patient_id", user.id);
  const requests = unwrap(await query);
  const ids = [...new Set(requests.map((r) => r.prescription_id))];
  const readDb = role === "admin" ? createAdminClient() : db;
  const prescriptions = ids.length
    ? unwrap(await readDb.from("prescriptions").select("id,patient_id,prescription_items(id,medication_name,quantity_units,unit_label)").in("id", ids))
    : [];
  return { user, requests, prescriptions };
}
export async function getIdentityQueue() {
  await requireAdmin();
  const db = await createClient();
  const result = await db.from("pas_identity_requests").select("*").in("status", ["pending", "processing"]).order("created_at").limit(100);
  const requests=unwrap(result);
  if(!requests.length) return requests;
  const ids=[...new Set(requests.map(r=>r.profile_id))];
  const names=unwrap(await createAdminClient().from("profiles").select("id,full_name,phone,national_id").in("id",ids));
  return requests.map(r=>({...r,profile:names.find(p=>p.id===r.profile_id)||null}));
}

export async function getRecordAccessData() {
  const user = await requireCareUser("patient");
  const db = await createClient();
  const [relations, grants] = await Promise.all([
    db.from("patient_doctor_relationships").select("id,doctor_id,status").eq("patient_id", user.id).eq("status", "active"),
    db.from("pas_record_access").select("*").eq("patient_id", user.id),
  ]);
  const rows = unwrap(relations);
  const ids = rows.map((r) => r.doctor_id);
  const profiles = ids.length ? unwrap(await db.from("profiles").select("id,full_name").in("id", ids)) : [];
  return rows.map((r) => ({ ...r, doctor_name: profiles.find((p) => p.id === r.doctor_id)?.full_name || "پزشک", grant: unwrap(grants).find((g) => g.doctor_id === r.doctor_id) || null }));
}
