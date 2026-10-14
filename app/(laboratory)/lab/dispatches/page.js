import Link from "next/link";
import { ClipboardCheck, ScanQrCode } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import LabDispatchCard from "@/features/lab-dispatch/components/LabDispatchCard";
import { getLabIncomingDispatches } from "@/features/lab-dispatch/queries";

export const metadata = { title: "درخواست‌های ارجاع‌شده" };
export const dynamic = "force-dynamic";
const FILTERS = [{ value: "pending", label: "در انتظار پاسخ" }, { value: "accepted", label: "پذیرفته‌شده" }, { value: "rejected", label: "ردشده" }, { value: "cancelled", label: "لغوشده" }, { value: "all", label: "همه" }];

export default async function LabDispatchesPage({ searchParams }) {
  const params = await searchParams;
  const requested = typeof params?.status === "string" ? params.status : "pending";
  const status = FILTERS.some((item) => item.value === requested) ? requested : "pending";
  const dispatches = await getLabIncomingDispatches({ status });

  return <div className="space-y-5">
    <PageHeader title="درخواست‌های ارجاع‌شده" description="درخواست‌هایی را بررسی کنید که بیماران به یکی از شعب شما فرستاده‌اند. پذیرش هر درخواست، پرونده‌ای را در صف پذیرش آزمایشگاه ایجاد می‌کند." actions={<Button asChild variant="outline"><Link href="/lab/intake/scan"><ScanQrCode aria-hidden="true" />اسکن کد پذیرش</Link></Button>} />
    <nav aria-label="فیلتر وضعیت درخواست‌ها" className="flex flex-wrap gap-2">{FILTERS.map((filter) => <Link key={filter.value} href={`/lab/dispatches?status=${filter.value}`} className={`rounded-full border px-3 py-1.5 text-sm ${filter.value === status ? "border-primary bg-accent text-primary" : "hover:bg-muted"}`}>{filter.label}</Link>)}</nav>
    {dispatches.length ? <div className="grid gap-4">{dispatches.map((dispatch) => <LabDispatchCard key={dispatch.dispatch_id || dispatch.id} dispatch={dispatch} />)}</div> : <EmptyState icon={ClipboardCheck} title="درخواستی در این فهرست نیست" description="درخواست‌های ارسالی به شعبهٔ شما پس از ثبت توسط بیمار در این صفحه نمایش داده می‌شوند." action={{ href: "/lab/orders", label: "مشاهده صف پذیرش" }} />}
  </div>;
}
