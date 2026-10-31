import "server-only";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { CENTER_TYPES, centerHome } from "@/lib/centers/config";
import { monthStart, moveMonth, tehranDayKey, tehranDateTimeToISO, dayDate } from "@/lib/care/dates";
import { getPostLoginRedirect } from "@/lib/auth/redirects";

export async function requireCenter(type) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!["laboratory", "medical_center"].includes(user.role)) redirect(getPostLoginRedirect(user));
  if (!CENTER_TYPES[user.center_type] || user.center_active !== true) redirect("/center/unavailable");
  if (type && !CENTER_TYPES[type]) notFound();
  if (type && type !== user.center_type) redirect(centerHome(user.center_type));
  return user;
}
export async function getCenterWorklist(type, requestId = null, options = {}) {
  const user = await requireCenter(type);
  const db = await createClient();
  let page = Math.min(10000, Math.max(1, Number.parseInt(options.page,10)||1));
  const query = typeof options.q === "string" ? options.q.trim().slice(0,100) : "";
  const status = ["requested","accepted","in_progress","reported","cancelled"].includes(options.status) ? options.status : null;
  const month = monthStart(dayDate(options.month) ? options.month : tehranDayKey());
  const payload={p_request:requestId,p_page:page,p_status:status,p_query:query||null,p_from:options.calendar ? tehranDateTimeToISO(month):null,p_to:options.calendar ? tehranDateTimeToISO(moveMonth(month,1)):null};
  let result = await db.rpc("pas_center_worklist", payload);
  if (result.error) throw result.error;
  const pages=Math.max(1,Math.ceil(Number(result.data?.total||0)/20));
  if(!requestId&&!options.calendar&&page>pages){page=pages;result=await db.rpc("pas_center_worklist",{...payload,p_page:page});if(result.error)throw result.error;}
  return { user, requests: result.data?.items || [], counts:result.data?.counts||{},total:Number(result.data?.total||0),page,pages,query,status,month,providers: [], config: CENTER_TYPES[user.center_type] };
}
export async function getAdminCenters(type) {
  await requireAdmin();
  const db = createAdminClient();
  let query = db.from("pas_medical_centers").select("*,laboratory_profiles(license_number,profiles!laboratory_profiles_id_fkey(full_name,phone))").order("created_at", { ascending: false }).limit(200);
  if (CENTER_TYPES[type]) query = query.eq("center_type", type);
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}
