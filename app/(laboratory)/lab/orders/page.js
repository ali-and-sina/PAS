import Link from "next/link";
import { ListChecks } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import OrderQueueTable from "@/features/lab-orders/components/OrderQueueTable";
import { getLabOrders } from "@/features/lab/queries";

export const metadata = { title: "صف سفارش‌های آزمایشگاه" };

export default async function LabOrdersPage() {
  const orders = await getLabOrders();
  return (
    <>
      <PageHeader title="صف سفارش‌ها" description="سفارش‌های ارجاع‌شده به آزمایشگاه را از دریافت تا تکمیل مدیریت کنید." />
      {orders.length ? <OrderQueueTable orders={orders} /> : <EmptyState icon={ListChecks} title="سفارشی وجود ندارد" description="وقتی پزشکان سفارشی را به این آزمایشگاه ارجاع دهند، در اینجا نمایش داده می‌شود." />}
    </>
  );
}
