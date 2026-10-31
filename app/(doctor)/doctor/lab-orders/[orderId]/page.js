import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorLabRequests } from "@/features/lab-order-requests/queries";
import { getDoctorLabOrders } from "@/features/lab-orders/queries";

export const metadata = { title: "جزئیات درخواست آزمایش" };
const REQUEST_STATUS = { submitted: "در انتظار انتخاب آزمایشگاه توسط بیمار", cancelled: "لغوشده", fulfilled: "انجام‌شده" };
const DISPATCH_STATUS = { pending: "در انتظار پاسخ آزمایشگاه", accepted: "پذیرفته‌شده", rejected: "ردشده", cancelled: "لغوشده" };
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function itemName(item) { return item.panel?.name_fa || item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"; }

export default async function DoctorLabOrderDetailPage({ params }) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const requests = await getDoctorLabRequests({ requestId: orderId });
  const request = requests.find((item) => item.id === orderId);
  if (!request) {
    const legacyOrders = await getDoctorLabOrders(user.id, null, { orderId });
    const order = legacyOrders.find((item) => item.id === orderId);
    if (!order) notFound();
    const statusLabel = { pending: "در انتظار شروع کار", received_by_lab: "پذیرفته‌شده توسط آزمایشگاه", in_progress: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده" }[order.status] || order.status;
    return <div className="space-y-5">
      <PageHeader title="جزئیات آزمایش" description={`بیمار: ${order.patient_name || "بیمار"}`} actions={<Button asChild variant="outline"><Link href="/doctor/medical-services"><ArrowRight aria-hidden="true" />بازگشت به مراکز درمانی</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="خلاصه آزمایش"><dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{order.patient_name || "—"}</dd></div><div><dt className="text-muted-foreground">آزمایشگاه</dt><dd className="mt-1">{order.laboratory_name || "—"}</dd></div><div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1">{statusLabel}</dd></div><div><dt className="text-muted-foreground">زمان ثبت درخواست آزمایش</dt><dd className="mt-1">{formatDate(order.ordered_at)}</dd></div><div><dt className="text-muted-foreground">تعداد آزمایش</dt><dd className="mt-1">{order.test_count || 0}</dd></div></dl></SectionCard>
        <SectionCard title="یادداشت بالینی"><p className="whitespace-pre-wrap text-sm leading-7">{order.clinical_note || "یادداشت بالینی ثبت نشده است."}</p></SectionCard>
      </div>
    </div>;
  }

  return <div className="space-y-5">
    <PageHeader title="جزئیات درخواست آزمایش" description={`بیمار: ${request.patient_name || "بیمار"}`} actions={<Button asChild variant="outline"><Link href="/doctor/medical-services"><ArrowRight aria-hidden="true" />بازگشت به مراکز درمانی</Link></Button>} />
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="خلاصه درخواست"><dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{request.patient_name || "—"}</dd></div><div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1">{REQUEST_STATUS[request.status] || request.status}</dd></div><div><dt className="text-muted-foreground">زمان ثبت</dt><dd className="mt-1">{formatDate(request.created_at)}</dd></div><div><dt className="text-muted-foreground">آخرین به‌روزرسانی</dt><dd className="mt-1">{formatDate(request.updated_at)}</dd></div></dl></SectionCard>
      <SectionCard title="آزمایش‌های درخواست‌شده">{request.items.length ? <ul className="space-y-2 text-sm">{request.items.map((item) => <li key={item.id} className="rounded-lg border p-3">{itemName(item)} <span className="text-xs text-muted-foreground">{item.test_panel_id ? "پنل آزمایش" : "آزمایش تکی"}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">موردی برای این درخواست ثبت نشده است.</p>}</SectionCard>
      <SectionCard title="یادداشت بالینی" className="lg:col-span-2"><p className="whitespace-pre-wrap text-sm leading-7">{request.clinical_note || "یادداشت بالینی ثبت نشده است."}</p></SectionCard>
      <SectionCard title="ارسال‌های آزمایشگاهی" className="lg:col-span-2">{request.dispatches.length ? <div className="space-y-3">{request.dispatches.map((dispatch) => <div key={dispatch.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{dispatch.branch?.display_name || "شعبه نامشخص"}</p><span className="rounded-full bg-muted px-3 py-1 text-xs">{DISPATCH_STATUS[dispatch.status] || dispatch.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{dispatch.branch?.city || "شهر نامشخص"} · ارسال در {formatDate(dispatch.sent_at)}</p>{dispatch.response_note && <p className="mt-2 text-sm">پاسخ آزمایشگاه: {dispatch.response_note}</p>}{dispatch.requested_home_collection && <p className="mt-2 text-sm text-primary">بیمار نمونه‌گیری در منزل را درخواست کرده است.</p>}</div>)}</div> : <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4"><Clock3 className="mt-0.5 size-5 text-muted-foreground" /><p className="text-sm leading-6 text-muted-foreground">درخواست ثبت شده است. بیمار پس از ورود به حساب خود، شعبهٔ آزمایشگاه و در صورت نیاز نمونه‌گیری در منزل را انتخاب می‌کند.</p></div>}</SectionCard>
    </div>
  </div>;
}
