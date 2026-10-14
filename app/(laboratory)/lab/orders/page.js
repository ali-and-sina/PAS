import { ListChecks } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import OrderQueueTable from "@/features/lab-orders/components/OrderQueueTable";
import LabStatusFilters from "@/features/lab/components/LabStatusFilters";
import { getLabOrders } from "@/features/lab/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "صف پذیرش آزمایشگاه" };
export const dynamic = "force-dynamic";

export default async function LabOrdersPage({ searchParams }) {
  const params = searchParams ? await searchParams : {};
  const requestedStatus = typeof params?.status === "string" ? params.status : "";
  const allowedStatuses = new Set(["pending", "received_by_lab", "in_progress", "completed", "cancelled"]);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "";
  const page = params?.page ?? 1;

  const result = await getLabOrders(status || null, { page });
  const orders = result.items;

  return (
    <div className="space-y-5">
      <PageHeader title="صف پذیرش" description="پذیرش‌های آزمایش را از ثبت تا نهایی‌شدن نتیجه مدیریت کنید." />
      <LabStatusFilters active={status} />

      {orders.length ? (
        <OrderQueueTable orders={orders} />
      ) : (
        <EmptyState
          icon={ListChecks}
          title={status ? "پذیرشی در این وضعیت وجود ندارد" : "پذیرشی وجود ندارد"}
          description="پذیرش‌های مرتبط با این آزمایشگاه پس از ارسال درخواست بیمار در اینجا نمایش داده می‌شوند."
        />
      )}
      <Pagination pathname="/lab/orders" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} query={{ status }} />
    </div>
  );
}
