import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const metadata = { title: "یادداشت‌های پزشک" };
export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function DoctorNotesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) redirect("/doctor/dashboard");

  const supabase = await createClient();
  const { data: notes, error } = await supabase
    .from("doctor_notes")
    .select("id, patient_id, diagnostic_report_id, content, created_at")
    .eq("doctor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const patientIds = [...new Set((notes || []).map((note) => note.patient_id))];
  let profiles = [];
  if (patientIds.length) {
    const { data, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", patientIds);
    if (profilesError) throw profilesError;
    profiles = data || [];
  }
  const names = new Map(profiles.map((row) => [row.id, row.full_name || "بیمار"]));

  return (
    <div className="space-y-5">
      <PageHeader title="یادداشت‌های پزشک" description="یادداشت‌های ثبت‌شده برای بیمارانی که اکنون رابطه فعال دارند." />
      {!notes?.length ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">یادداشتی ثبت نشده است.</p> : (
        <div className="space-y-3">
          {notes.map((note) => (
            <article key={note.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <Link href={`/doctor/patients/${note.patient_id}`} className="font-medium text-primary hover:underline">{names.get(note.patient_id) || "بیمار"} · مشاهده پرونده</Link>
                <time className="text-xs text-muted-foreground">{formatDate(note.created_at)}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{note.content}</p>
              {note.diagnostic_report_id ? <p className="mt-2 text-xs text-muted-foreground">دارای گزارش مرتبط</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
