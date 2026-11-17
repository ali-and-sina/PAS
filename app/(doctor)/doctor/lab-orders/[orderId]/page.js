import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Clock3, FileCheck2 } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorLabRequests } from "@/features/lab-order-requests/queries";
import { getDoctorLabOrder } from "@/features/lab-orders/queries";
import { formatReferenceRange } from "@/features/lab-results/reference-format";

export const metadata = { title: "جزئیات درخواست آزمایش" };
const REQUEST_STATUS = { submitted: "در انتظار انتخاب آزمایشگاه توسط بیمار", cancelled: "لغوشده", fulfilled: "انجام‌شده" };
const DISPATCH_STATUS = { pending: "در انتظار پاسخ آزمایشگاه", accepted: "پذیرفته‌شده", rejected: "ردشده", cancelled: "لغوشده" };
const REPORT_STATUS = { final: "نهایی", amended: "اصلاح‌شده" };

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

function itemName(item) {
  return item.panel?.name_fa || item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش";
}

function observationValue(observation) {
  if (observation.value_numeric !== null && observation.value_numeric !== undefined) return observation.value_numeric;
  if (observation.value_boolean !== null && observation.value_boolean !== undefined) return observation.value_boolean ? "مثبت" : "منفی";
  return observation.value_text ?? "—";
}

function observationFlag(flag) {
  return ({
    low: "پایین",
    high: "بالا",
    critical: "بحرانی",
    critical_low: "بحرانی (پایین)",
    critical_high: "بحرانی (بالا)",
    normal: "طبیعی",
    unknown: "نامشخص",
  })[flag] || null;
}

function LabReportCard({ report }) {
  const observations = Array.isArray(report.observations) ? report.observations : [];
  return (
    <article id={`report-${report.id}`} className="scroll-mt-24 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="font-semibold">نتیجهٔ آزمایش</h3>
          <p className="mt-1 text-xs text-muted-foreground">نهایی‌شده در {formatDate(report.finalized_at || report.created_at)}</p>
        </div>
        <StatusBadge label={REPORT_STATUS[report.status] || "نهایی"} variant={report.status === "amended" ? "amended" : "normal"} />
      </div>
      {observations.length ? (
        <div className="mt-3 space-y-2">
          {observations.map((observation) => {
            const test = Array.isArray(observation.test_definitions)
              ? observation.test_definitions[0]
              : observation.test_definitions;
            const flag = observationFlag(observation.flag);
            return (
              <div key={observation.id} className="grid gap-2 rounded-lg bg-muted/25 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(5rem,.6fr)_minmax(5rem,.7fr)_minmax(7rem,.9fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{test?.name_fa || test?.name || "آزمایش"}</p>
                  {test?.internal_code ? <p className="mt-1 text-xs text-muted-foreground">{test.internal_code}</p> : null}
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground">نتیجه</p>
                  <p className="mt-1 font-semibold tabular-nums">{observationValue(observation)}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground">واحد</p>
                  <p className="mt-1 text-sm">{observation.unit || test?.default_unit || "—"}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground">محدوده مرجع</p>
                  <p className="mt-1 text-sm">{formatReferenceRange(observation) || "ثبت نشده"}</p>
                </div>
                {flag ? <p className="text-xs text-muted-foreground sm:col-span-4">وضعیت ثبت‌شده: {flag}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          گزارش نهایی ثبت شده، اما ردیف قابل‌نمایشی برای نتیجهٔ آن در دسترس نیست.
        </p>
      )}
    </article>
  );
}

function OrderResults({ orders, emptyMessage = "نتیجهٔ نهایی هنوز توسط آزمایشگاه منتشر نشده است." }) {
  const reportEntries = (orders || []).flatMap((order) =>
    (order?.reports || []).map((report) => ({ order, report })),
  );
  return (
    <SectionCard title="نتایج ثبت‌شده توسط آزمایشگاه">
      {reportEntries.length ? (
        <div className="space-y-3">
          {reportEntries.map(({ order, report }) => (
            <div key={report.id} className="space-y-2">
              {order?.laboratory?.full_name ? <p className="text-xs text-muted-foreground">{order.laboratory.full_name}</p> : null}
              <LabReportCard report={report} />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
      )}
    </SectionCard>
  );
}

function PatientLink({ patientId }) {
  return patientId ? (
    <Button asChild variant="outline">
      <Link href={`/doctor/patients/${patientId}`}><ArrowRight aria-hidden="true" />بازگشت به پرونده بیمار</Link>
    </Button>
  ) : (
    <Button asChild variant="outline">
      <Link href="/doctor/medical-services"><ArrowRight aria-hidden="true" />بازگشت به مراکز درمانی</Link>
    </Button>
  );
}

export default async function DoctorLabOrderDetailPage({ params }) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) redirect("/doctor/dashboard");

  const requests = await getDoctorLabRequests({ requestId: orderId });
  const request = requests.find((item) => item.id === orderId);

  if (request) {
    const linkedOrderIds = [...new Set((request.dispatches || []).map((dispatch) => dispatch.lab_order_id).filter(Boolean))].slice(0, 20);
    const linkedOrders = (await Promise.all(linkedOrderIds.map((id) => getDoctorLabOrder(user.id, id)))).filter(Boolean);

    return (
      <div className="space-y-5">
        <PageHeader
          title="جزئیات درخواست آزمایش"
          description={`بیمار: ${request.patient_name || "بیمار"}`}
          actions={<PatientLink patientId={request.patient_id} />}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="خلاصه درخواست">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{request.patient_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1">{REQUEST_STATUS[request.status] || request.status}</dd></div>
              <div><dt className="text-muted-foreground">زمان ثبت</dt><dd className="mt-1">{formatDate(request.created_at)}</dd></div>
              <div><dt className="text-muted-foreground">آخرین به‌روزرسانی</dt><dd className="mt-1">{formatDate(request.updated_at)}</dd></div>
            </dl>
          </SectionCard>
          <SectionCard title="آزمایش‌های درخواست‌شده">
            {request.items.length ? (
              <ul className="space-y-2 text-sm">
                {request.items.map((item) => <li key={item.id} className="rounded-lg border p-3">{itemName(item)} <span className="text-xs text-muted-foreground">{item.test_panel_id ? "پنل آزمایش" : "آزمایش تکی"}</span></li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">موردی برای این درخواست ثبت نشده است.</p>}
          </SectionCard>
          <SectionCard title="یادداشت بالینی" className="lg:col-span-2">
            <p className="whitespace-pre-wrap text-sm leading-7">{request.clinical_note || "یادداشت بالینی ثبت نشده است."}</p>
          </SectionCard>
          <SectionCard title="ارسال‌های آزمایشگاهی" className="lg:col-span-2">
            {request.dispatches.length ? (
              <div className="space-y-3">
                {request.dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{dispatch.branch?.display_name || "شعبه نامشخص"}</p>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs">{DISPATCH_STATUS[dispatch.status] || dispatch.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{dispatch.branch?.city || "شهر نامشخص"} · ارسال در {formatDate(dispatch.sent_at)}</p>
                    {dispatch.response_note ? <p className="mt-2 text-sm">پاسخ آزمایشگاه: {dispatch.response_note}</p> : null}
                    {dispatch.requested_home_collection ? <p className="mt-2 text-sm text-primary">بیمار نمونه‌گیری در منزل را درخواست کرده است.</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
                <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">درخواست ثبت شده است. بیمار پس از ورود به حساب خود، شعبهٔ آزمایشگاه و در صورت نیاز نمونه‌گیری در منزل را انتخاب می‌کند.</p>
              </div>
            )}
          </SectionCard>
          <div className="lg:col-span-2">
            <OrderResults orders={linkedOrders} />
          </div>
        </div>
      </div>
    );
  }

  const order = await getDoctorLabOrder(user.id, orderId);
  if (!order) notFound();
  const statusLabel = {
    pending: "در انتظار شروع کار",
    received_by_lab: "پذیرفته‌شده توسط آزمایشگاه",
    in_progress: "در حال انجام",
    completed: "تکمیل‌شده",
    cancelled: "لغوشده",
  }[order.status] || order.status;

  return (
    <div className="space-y-5">
      <PageHeader
        title="جزئیات آزمایش"
        description={`بیمار: ${order.patient?.full_name || "بیمار"}`}
        actions={<PatientLink patientId={order.patient_id} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="خلاصه آزمایش">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{order.patient?.full_name || "—"}</dd></div>
            <div><dt className="text-muted-foreground">آزمایشگاه</dt><dd className="mt-1">{order.laboratory?.full_name || "—"}</dd></div>
            <div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1">{statusLabel}</dd></div>
            <div><dt className="text-muted-foreground">زمان ثبت درخواست آزمایش</dt><dd className="mt-1">{formatDate(order.ordered_at)}</dd></div>
            <div><dt className="text-muted-foreground">تعداد آزمایش‌های درخواست‌شده</dt><dd className="mt-1">{order.items.length}</dd></div>
          </dl>
        </SectionCard>
        <SectionCard title="آزمایش‌های درخواست‌شده">
          {order.items.length ? <ul className="space-y-2 text-sm">{order.items.map((item) => <li key={item.id} className="rounded-lg border p-3">{itemName(item)}</li>)}</ul> : <p className="text-sm text-muted-foreground">جزئیات اقلام درخواست ثبت نشده است.</p>}
        </SectionCard>
        <SectionCard title="یادداشت بالینی" className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm leading-7">{order.clinical_note || "یادداشت بالینی ثبت نشده است."}</p>
        </SectionCard>
        <div className="lg:col-span-2">
          <OrderResults
            orders={[order]}
            emptyMessage="این درخواست هنوز گزارش نهاییِ دارای نتیجه ندارد. پس از نهایی‌شدن جواب توسط آزمایشگاه، مقادیر در همین صفحه نمایش داده می‌شوند."
          />
        </div>
      </div>
    </div>
  );
}
