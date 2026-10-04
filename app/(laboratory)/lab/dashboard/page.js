import Link from "next/link";
import { Beaker, FlaskConical, ListChecks, PencilLine } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/shared/EmptyState";
import OrderQueueTable from "@/features/lab-orders/components/OrderQueueTable";
import { getLabDashboard } from "@/features/lab/queries";

export const metadata = { title: "داشبورد آزمایشگاه" };

export default async function LabDashboardPage() {
  const data = await getLabDashboard();
  const stats = [
    { label: "سفارش‌های جدید", value: data.newOrders, icon: Beaker },
    { label: "در حال انجام", value: data.inProgress, icon: FlaskConical },
    { label: "پیش‌نویس نتایج", value: data.draftReports, icon: PencilLine },
    { label: "آماده نهایی‌سازی", value: data.readyToFinalize, icon: ListChecks },
  ];

  return (
    <div>
      <PageHeader title="داشبورد" description="صف کار آزمایشگاه از سفارش تا نهایی‌سازی نتیجه." actions={<Button asChild size="sm"><Link href="/lab/orders">مشاهده صف سفارش‌ها</Link></Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map((stat) => <Card key={stat.label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{stat.value}</p></CardContent></Card>)}</div>
      {data.recentOrders.length ? <OrderQueueTable orders={data.recentOrders} /> : <EmptyState icon={ListChecks} title="صف سفارش‌ها خالی است" description="سفارش‌هایی که پزشکان ثبت کنند در این صفحه و در صف سفارش‌ها نمایش داده می‌شوند." />}
    </div>
  );
}
