import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorLabOrder } from "@/features/lab-orders/queries";

export const metadata = { title: "جزئیات سفارش آزمایش" };

const labels = { pending: "در انتظار", received_by_lab: "دریافت‌شده", in_progress: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده" };

function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default async function DoctorLabOrderDetailPage({ params }) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const order = await getDoctorLabOrder(user.id, orderId);
  if (!order) notFound();

  return (
    <>
      <PageHeader title="جزئیات سفارش آزمایش" description={`بیمار: ${order.patient?.full_name || "بدون نام"}`} actions={<Button asChild variant="outline"><Link href="/doctor/lab-orders">بازگشت</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="خلاصه سفارش"><dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1">{order.patient?.full_name || "—"}</dd></div><div><dt className="text-muted-foreground">آزمایشگاه</dt><dd className="mt-1">{order.laboratory?.full_name || "—"}</dd></div><div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1">{labels[order.status] || order.status}</dd></div><div><dt className="text-muted-foreground">تاریخ ثبت</dt><dd className="mt-1">{formatDate(order.ordered_at)}</dd></div></dl></SectionCard>
        <SectionCard title="آزمایش‌های درخواست‌شده">{order.items.length ? <ul className="space-y-2 text-sm">{order.items.map((item) => <li key={item.id} className="rounded-lg border p-3">{item.panel?.name || item.test?.name || "آزمایش"}</li>)}</ul> : <p className="text-sm text-muted-foreground">موردی برای این سفارش ثبت نشده است.</p>}</SectionCard>
        <SectionCard title="یادداشت بالینی" className="lg:col-span-2"><p className="whitespace-pre-wrap text-sm leading-7">{order.clinical_note || "یادداشت بالینی ثبت نشده است."}</p></SectionCard>
        <SectionCard title="گزارش‌های آزمایشگاه" className="lg:col-span-2">{order.reports.length ? <div className="space-y-2">{order.reports.map((report) => <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"><span>گزارش {report.status === "final" ? "نهایی" : report.status === "amended" ? "اصلاح‌شده" : "پیش‌نویس"}</span><span className="text-muted-foreground">{formatDate(report.finalized_at || report.created_at)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">هنوز گزارشی از آزمایشگاه دریافت نشده است.</p>}</SectionCard>
      </div>
    </>
  );
}
