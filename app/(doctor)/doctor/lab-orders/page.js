import Link from "next/link";
import { redirect } from "next/navigation";
import { Beaker, Clock3, CheckCircle2, XCircle } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorLabRequests } from "@/features/lab-order-requests/queries";
import { getDoctorLabOrders } from "@/features/lab-orders/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "درخواست‌های آزمایش" };

const STATUS = {
  submitted: { label: "در انتظار انتخاب آزمایشگاه توسط بیمار", className: "bg-amber-50 text-amber-800" },
  cancelled: { label: "لغوشده", className: "bg-muted text-muted-foreground" },
  fulfilled: { label: "انجام‌شده", className: "bg-emerald-50 text-emerald-800" },
};
const DISPATCH = {
  pending: "در انتظار پاسخ آزمایشگاه",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function itemName(item) { return item.panel?.name_fa || item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"; }

export default async function DoctorLabOrdersPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const requestedStatus = typeof query?.status === "string" ? query.status : "";
  const statusFilter = ["submitted", "cancelled", "fulfilled"].includes(requestedStatus) ? requestedStatus : "";
  const page = query?.page ?? 1;
  const ordersPage = query?.ordersPage ?? 1;
  const operationalStatusFilter = statusFilter === "submitted" ? "open" : statusFilter === "fulfilled" ? "completed" : statusFilter || null;
  const [requestResult, operationalResult] = await Promise.all([
    getDoctorLabRequests({ page, status: statusFilter || null }),
    getDoctorLabOrders(user.id, operationalStatusFilter, { page: ordersPage }),
  ]);
  const requests = requestResult.items;
  const operationalOrders = operationalResult.items;
  const ORDER_STATUS = { pending: "در انتظار شروع کار", received_by_lab: "پذیرفته‌شده توسط آزمایشگاه", in_progress: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده" };

  return (
    <div className="space-y-5">
      <PageHeader title="درخواست‌های آزمایش" description="آزمایش‌های تجویزشده را پیگیری کنید؛ انتخاب شعبه و شیوهٔ نمونه‌گیری با بیمار است." actions={<Button asChild><Link href="/doctor/lab-orders/new">ثبت درخواست جدید</Link></Button>} />
      <nav aria-label="فیلتر وضعیت" className="flex flex-wrap gap-2">
        {[{ value: "", label: "همه" }, { value: "submitted", label: "در انتظار اقدام بیمار" }, { value: "fulfilled", label: "انجام‌شده" }, { value: "cancelled", label: "لغوشده" }].map((filter) => <Link key={filter.value} href={filter.value ? `/doctor/lab-orders?status=${filter.value}` : "/doctor/lab-orders"} className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === filter.value ? "border-primary bg-accent text-primary" : "hover:bg-muted"}`}>{filter.label}</Link>)}
      </nav>
      {requests.length === 0 ? <EmptyState icon={Beaker} title="درخواستی پیدا نشد" description="برای ثبت اولین درخواست آزمایش، بیمار و آزمایش‌های موردنیاز را انتخاب کنید." action={{ href: "/doctor/lab-orders/new", label: "ثبت درخواست آزمایش" }} /> : (
        <div className="grid gap-3">
          {requests.map((request) => {
            const latest = request.dispatches?.[0];
            const status = STATUS[request.status] || { label: request.status, className: "bg-muted text-muted-foreground" };
            return <article key={request.id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{request.patient_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">ثبت‌شده در {formatDate(request.created_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{request.items.map((item) => <span key={item.id} className="rounded-md bg-muted px-2 py-1 text-xs">{itemName(item)}</span>)}</div>
                  {latest && <p className="mt-3 text-sm text-muted-foreground">آخرین ارسال: {latest.branch?.display_name || "شعبه نامشخص"} · {DISPATCH[latest.status] || latest.status}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${status.className}`}>{request.status === "fulfilled" ? <CheckCircle2 className="size-3.5" /> : request.status === "cancelled" ? <XCircle className="size-3.5" /> : <Clock3 className="size-3.5" />}{status.label}</span>
                  <Button asChild variant="outline" size="sm"><Link href={`/doctor/lab-orders/${request.id}`}>جزئیات درخواست</Link></Button>
                </div>
              </div>
            </article>;
          })}
        </div>
      )}
      <Pagination pathname="/doctor/lab-orders" page={requestResult.pagination.page} pageSize={requestResult.pagination.pageSize} totalCount={requestResult.pagination.totalCount} totalPages={requestResult.pagination.totalPages} query={{ status: statusFilter, ordersPage: operationalResult.pagination.page }} />
      {operationalResult.pagination.totalCount > 0 && <section className="space-y-3 pt-3">
        <div><h2 className="text-lg font-semibold">سفارش‌های عملیاتی آزمایشگاه</h2><p className="mt-1 text-sm text-muted-foreground">سفارش‌هایی که پس از پذیرش ارجاع توسط آزمایشگاه ایجاد شده‌اند، در این بخش پیگیری می‌شوند.</p></div>
        <div className="grid gap-3">{operationalOrders.map((order) => <article key={order.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-medium">{order.patient_name || "بیمار"}</p><p className="mt-1 text-sm text-muted-foreground">{order.laboratory_name || "آزمایشگاه"} · {formatDate(order.ordered_at)}</p><p className="mt-2 text-xs text-muted-foreground">{ORDER_STATUS[order.status] || order.status} · {order.test_count || 0} آزمایش</p></div>
          <Button asChild variant="outline" size="sm"><Link href={`/doctor/lab-orders/${order.id}`}>جزئیات سفارش</Link></Button>
        </article>)}</div>
        <Pagination pathname="/doctor/lab-orders" page={operationalResult.pagination.page} pageSize={operationalResult.pagination.pageSize} totalCount={operationalResult.pagination.totalCount} totalPages={operationalResult.pagination.totalPages} pageParam="ordersPage" query={{ status: statusFilter, page: requestResult.pagination.page }} />
      </section>}
    </div>
  );
}
