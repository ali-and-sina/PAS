import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, FileText, FlaskConical } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import OrderDetailCard from "@/features/lab-orders/components/OrderDetailCard";
import OrderStatusBadge from "@/features/lab-orders/components/OrderStatusBadge";
import LabWorkflowStrip from "@/features/lab/components/LabWorkflowStrip";
import { getLabOrder } from "@/features/lab/queries";
import { getSessionUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updateLabOrderStatus } from "@/features/lab-results/actions";

export const metadata = { title: "جزئیات پذیرش آزمایش" };
export const dynamic = "force-dynamic";

function StatusAction({ orderId, status, label, variant = "default" }) {
  return (
    <form action={updateLabOrderStatus}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={variant}>{label}</Button>
    </form>
  );
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export default async function LabOrderDetailPage({ params }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "laboratory") redirect("/login");

  const { orderId } = await params;
  const order = await getLabOrder(orderId);
  if (!order) notFound();

  const draftReport = order.reports.find((report) => report.status === "draft");
  const canCancel = ["pending", "received_by_lab", "in_progress"].includes(order.status);
  const canEnter = order.status === "in_progress";

  return (
    <div className="space-y-5">
      <PageHeader
        title="جزئیات پذیرش"
        description={`بیمار: ${order.patient?.full_name || "بدون نام"}`}
        actions={<Button asChild variant="outline" size="sm"><Link href="/lab/orders"><ArrowLeft className="size-4" aria-hidden="true" /> بازگشت</Link></Button>}
      />

      <LabWorkflowStrip status={draftReport ? "draft" : order.status} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
        <OrderStatusBadge status={order.status} />

        {order.status === "pending" ? <StatusAction orderId={order.id} status="received_by_lab" label="پذیرش آزمایش" /> : null}
        {order.status === "received_by_lab" ? <StatusAction orderId={order.id} status="in_progress" label="شروع انجام آزمایش" /> : null}
        {canEnter ? (
          <Button asChild size="sm">
            <Link href={`/lab/orders/${order.id}/results/new`}>
              <FlaskConical className="size-4" aria-hidden="true" />
              {draftReport ? "ادامه ثبت نتیجه" : "ثبت نتیجه"}
            </Link>
          </Button>
        ) : null}
        {canCancel ? <StatusAction orderId={order.id} status="cancelled" label="لغو پذیرش" variant="outline" /> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <OrderDetailCard order={order} />

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                زمان‌بندی
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">ثبت درخواست</dt><dd className="mt-1">{formatDate(order.ordered_at)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">دریافت</dt><dd className="mt-1">{formatDate(order.received_at)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">تکمیل</dt><dd className="mt-1">{formatDate(order.completed_at)}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 font-semibold">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                گزارش‌ها
              </div>
              {order.reports.length ? (
                <div className="mt-4 space-y-2">
                  {order.reports.map((report) => (
                    <Link key={report.id} href={`/lab/results/${report.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/40">
                      <span>{report.status === "draft" ? "پیش‌نویس" : report.status === "amended" ? "اصلاح‌شده" : "نهایی"}</span>
                      <OrderStatusBadge status={report.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">هنوز گزارشی برای این پذیرش ثبت نشده است.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
