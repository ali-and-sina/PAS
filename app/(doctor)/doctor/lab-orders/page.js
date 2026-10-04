import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorLabOrders } from "@/features/lab-orders/queries";

export const metadata = { title: "سفارش آزمایش" };

const labels = { pending: "در انتظار", received_by_lab: "دریافت‌شده", in_progress: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده" };

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export default async function DoctorLabOrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const orders = await getDoctorLabOrders(user.id);

  return (
    <>
      <PageHeader title="سفارش آزمایش" description="سفارش‌های ثبت‌شده برای بیماران شما." actions={<Button asChild><Link href="/doctor/lab-orders/new">سفارش جدید</Link></Button>} />
      {orders.length === 0 ? <EmptyState title="هنوز سفارشی ثبت نشده است." description="برای شروع، یک سفارش آزمایش جدید برای بیمار ایجاد کنید." action={{ href: "/doctor/lab-orders/new", label: "سفارش جدید" }} /> : (
        <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b bg-muted/40"><tr><th className="p-4 text-right font-medium">بیمار</th><th className="p-4 text-right font-medium">آزمایشگاه</th><th className="p-4 text-right font-medium">وضعیت</th><th className="p-4 text-right font-medium">تاریخ</th><th className="p-4 text-right font-medium">عملیات</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b last:border-0"><td className="p-4 font-medium">{order.patient_name}</td><td className="p-4">{order.laboratory_name}</td><td className="p-4">{labels[order.status] || order.status}</td><td className="p-4">{formatDate(order.ordered_at)}</td><td className="p-4"><Link href={`/doctor/lab-orders/${order.id}`} className="text-primary hover:underline">مشاهده</Link></td></tr>)}</tbody></table></div></div>)}
    </>
  );
}
