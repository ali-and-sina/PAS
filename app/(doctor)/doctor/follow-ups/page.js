import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { PhysicianFollowUpCreateForm, PhysicianFollowUpStatusForm } from "@/features/physician-care/components/FollowUpForms";

export const metadata = { title: "پیگیری‌های بیماران" };
export const dynamic = "force-dynamic";

function getToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

export default async function DoctorFollowUpsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) redirect("/doctor/dashboard");

  const params = await searchParams;
  const requestedStatus = typeof params?.status === "string" ? params.status : "all";
  const requestedFollowUpId = typeof params?.id === "string" ? params.id : null;
  const filter = new Set(["all", "due", "overdue", "completed", "cancelled"]).has(requestedStatus) ? requestedStatus : "all";
  const supabase = await createClient();

  const [{ data: relationships, error: relationshipsError }, { data: allFollowUps, error: followUpsError }] = await Promise.all([
    supabase.from("patient_doctor_relationships").select("patient_id").eq("doctor_id", user.id).eq("status", "active"),
    (() => {
      let query = supabase.from("follow_ups").select("id, patient_id, title, description, due_date, status, created_at, completed_at, cancelled_at").eq("doctor_id", user.id);
      if (requestedFollowUpId) query = query.eq("id", requestedFollowUpId);
      return query.order("due_date", { ascending: true }).limit(requestedFollowUpId ? 1 : 200);
    })(),
  ]);
  if (relationshipsError) throw relationshipsError;
  if (followUpsError) throw followUpsError;

  const activePatientIds = [...new Set((relationships || []).map((row) => row.patient_id))];
  const activePatientSet = new Set(activePatientIds);
  let profiles = [];
  if (activePatientIds.length) {
    const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", activePatientIds);
    if (error) throw error;
    profiles = data || [];
  }
  const patientNames = new Map(profiles.map((row) => [row.id, row.full_name || "بیمار"]));
  const today = getToday();
  const normalized = (allFollowUps || [])
    .filter((row) => activePatientSet.has(row.patient_id))
    .map((row) => ({
      ...row,
      patientName: patientNames.get(row.patient_id) || "بیمار",
      displayStatus: row.status === "overdue" || (row.status === "pending" && row.due_date < today) ? "overdue" : row.status,
    }));
  const followUps = normalized.filter((row) => {
    if (filter === "due") return row.status === "pending" && row.due_date === today;
    if (filter === "overdue") return row.displayStatus === "overdue";
    if (filter === "completed" || filter === "cancelled") return row.status === filter;
    return true;
  });

  const patientOptions = (relationships || []).map((row) => ({ id: row.patient_id, name: patientNames.get(row.patient_id) || "بیمار" }));
  const title = requestedFollowUpId ? "پیگیری انتخاب‌شده" : filter === "due" ? "پیگیری‌های امروز" : filter === "overdue" ? "پیگیری‌های عقب‌افتاده" : filter === "completed" ? "پیگیری‌های تکمیل‌شده" : filter === "cancelled" ? "پیگیری‌های لغوشده" : "پیگیری‌های بیماران";

  return (
    <div className="space-y-6">
      <PageHeader title={title} description="پیگیری‌ها به رابطه فعال بیمار و پزشک متصل هستند و وضعیت‌ها در سرور کنترل می‌شوند." actions={requestedFollowUpId ? <Link href="/doctor/follow-ups" className="text-sm text-primary hover:underline">نمایش همه پیگیری‌ها</Link> : null} />

      {filter === "all" ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">ایجاد پیگیری</h2>
          {patientOptions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">برای ایجاد پیگیری، ابتدا باید رابطه فعال با بیمار وجود داشته باشد.</p> : (
            <PhysicianFollowUpCreateForm patientOptions={patientOptions} />
          )}
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="فیلتر پیگیری‌ها">
        {[ ["all", "همه"], ["due", "امروز"], ["overdue", "عقب‌افتاده"], ["completed", "تکمیل‌شده"], ["cancelled", "لغوشده"] ].map(([value, label]) => (
          <Link key={value} href={value === "all" ? "/doctor/follow-ups" : `/doctor/follow-ups?status=${value}`} className={`rounded-full border px-3 py-1.5 ${filter === value ? "border-primary bg-accent text-primary" : "hover:bg-muted"}`}>{label}</Link>
        ))}
      </nav>

      {followUps.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">برای این فیلتر پیگیری‌ای وجود ندارد.</p> : (
        <div className="space-y-3">
          {followUps.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-medium">{item.title}</h2>
                  <Link href={`/doctor/patients/${item.patient_id}`} className="mt-1 inline-block text-sm text-primary hover:underline">{item.patientName} · مشاهده پرونده</Link>
                  {item.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
                </div>
                <div className="text-sm sm:text-left">
                  <p>{formatDate(item.due_date)}</p>
                  <p className={`mt-1 text-xs ${item.displayStatus === "overdue" ? "font-medium text-status-high" : "text-muted-foreground"}`}>
                    {item.displayStatus === "overdue" ? "عقب‌افتاده" : item.status === "pending" ? "در انتظار" : item.status === "completed" ? "تکمیل‌شده" : "لغوشده"}
                  </p>
                </div>
              </div>
              {["pending", "overdue"].includes(item.status) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <PhysicianFollowUpStatusForm id={item.id} status="completed" label="تکمیل" variant="outline" />
                  <PhysicianFollowUpStatusForm id={item.id} status="cancelled" label="لغو" variant="ghost" />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
