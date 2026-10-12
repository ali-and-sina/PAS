import Link from "next/link";
import { Home, ScanQrCode } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import HomeCollectionActionCard from "@/features/home-collection/components/HomeCollectionActionCard";
import { getLabHomeCollectionQueue } from "@/features/lab-dispatch/queries";
import { getSessionUser } from "@/lib/auth/server";

export const metadata = { title: "نمونه‌گیری در منزل" };
export const dynamic = "force-dynamic";
const FILTERS = [{ value: "requested", label: "در انتظار بررسی" }, { value: "approved", label: "تأییدشده" }, { value: "scheduled", label: "زمان‌بندی‌شده" }, { value: "dispatched", label: "اعزام‌شده" }, { value: "collected", label: "نمونه دریافت‌شده" }, { value: "all", label: "همه" }];

export default async function LabHomeCollectionPage({ searchParams }) {
  const params = await searchParams;
  const requested = typeof params?.status === "string" ? params.status : "requested";
  const status = FILTERS.some((item) => item.value === requested) ? requested : "requested";
  const [requests, user] = await Promise.all([getLabHomeCollectionQueue({ status }), getSessionUser()]);

  return <div className="space-y-5">
    <PageHeader title="نمونه‌گیری در منزل" description="درخواست را بررسی کنید، زمان مراجعه را تعیین کنید و وضعیت دریافت نمونه را ثبت کنید." actions={<Button asChild variant="outline"><Link href="/lab/intake/scan"><ScanQrCode aria-hidden="true" />اسکن کد</Link></Button>} />
    <nav aria-label="فیلتر وضعیت نمونه‌گیری" className="flex flex-wrap gap-2">{FILTERS.map((filter) => <Link key={filter.value} href={`/lab/home-collection?status=${filter.value}`} className={`rounded-full border px-3 py-1.5 text-sm ${filter.value === status ? "border-primary bg-accent text-primary" : "hover:bg-muted"}`}>{filter.label}</Link>)}</nav>
    {requests.length ? <div className="grid gap-4">{requests.map((request) => <HomeCollectionActionCard key={request.id} request={request} collectorProfileId={user?.id} />)}</div> : <EmptyState icon={Home} title="درخواستی برای این وضعیت نیست" description="درخواست‌های نمونه‌گیری در منزل که به شعبهٔ شما ارسال می‌شوند در این صفحه ظاهر خواهند شد." />}
  </div>;
}
