import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorPatient } from "@/features/patients/queries";
import { getDoctorPatientLabOrders } from "@/features/lab-orders/queries";
import { getDoctorPatientNotes } from "@/features/private-notes/queries";
import { getDoctorPatientPrescriptions } from "@/features/prescriptions/queries";

export const metadata = { title: "پرونده بیمار" };

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value));
}

const statusLabels = { pending: "در انتظار", received_by_lab: "دریافت‌شده", in_progress: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده" };

export default async function DoctorPatientDetailPage({ params }) {
  const { patientId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const patient = await getDoctorPatient(user.id, patientId);
  if (!patient) notFound();

  const [orders, notes, prescriptions] = await Promise.all([
    getDoctorPatientLabOrders(user.id, patientId),
    getDoctorPatientNotes(user.id, patientId),
    getDoctorPatientPrescriptions(user.id, patientId),
  ]);

  return (
    <>
      <PageHeader
        title={patient.full_name || "بیمار"}
        description="پرونده عملیاتی بیمار و فعالیت‌های مرتبط با او."
        actions={<div className="flex flex-wrap gap-2"><Button asChild><Link href={`/doctor/lab-orders/new?patientId=${patient.id}`}>سفارش آزمایش</Link></Button><Button asChild variant="outline"><Link href="/doctor/patients">فهرست بیماران</Link></Button></div>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="اطلاعات پایه">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted-foreground">کد ملی</dt><dd className="mt-1">{patient.national_id || "—"}</dd></div>
            <div><dt className="text-muted-foreground">موبایل</dt><dd className="mt-1 dir-ltr text-right">{patient.phone || "—"}</dd></div>
            <div><dt className="text-muted-foreground">تاریخ تولد</dt><dd className="mt-1">{formatDate(patient.patientProfile?.date_of_birth)}</dd></div>
            <div><dt className="text-muted-foreground">جنسیت</dt><dd className="mt-1">{patient.patientProfile?.sex || "—"}</dd></div>
            <div><dt className="text-muted-foreground">گروه خونی</dt><dd className="mt-1">{patient.patientProfile?.blood_type || "—"}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="سفارش‌های آزمایش" className="lg:col-span-2">
          {orders.length ? <div className="space-y-3">{orders.slice(0, 6).map((order) => <Link key={order.id} href={`/doctor/lab-orders/${order.id}`} className="block rounded-lg border p-4 hover:bg-muted/40"><div className="flex justify-between gap-3"><span className="font-medium">سفارش آزمایش</span><span className="text-xs text-muted-foreground">{statusLabels[order.status] || order.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.ordered_at)}</p></Link>)}</div> : <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>}
        </SectionCard>

        <SectionCard title="یادداشت‌های خصوصی" className="lg:col-span-2">
          {notes.length ? <div className="space-y-3">{notes.slice(0, 5).map((note) => <article key={note.id} className="rounded-lg border p-4"><p className="whitespace-pre-wrap text-sm leading-7">{note.content}</p><p className="mt-3 text-xs text-muted-foreground">{formatDate(note.created_at)}</p></article>)}</div> : <p className="text-sm text-muted-foreground">هنوز یادداشت خصوصی ثبت نشده است.</p>}
        </SectionCard>

        <SectionCard title="نسخه‌ها">
          {prescriptions.length ? <div className="space-y-3">{prescriptions.slice(0, 5).map((prescription) => <div key={prescription.id} className="rounded-lg border p-4"><div className="flex justify-between gap-3"><span className="font-medium">نسخه</span><span className="text-xs text-muted-foreground">{prescription.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(prescription.issued_at)}</p><p className="mt-3 text-sm">{prescription.items.length} قلم دارو</p></div>)}</div> : <p className="text-sm text-muted-foreground">هنوز نسخه‌ای ثبت نشده است.</p>}
        </SectionCard>
      </div>
    </>
  );
}
