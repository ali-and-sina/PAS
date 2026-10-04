import Link from "next/link";
import { Beaker, Stethoscope, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/shared/EmptyState";
import { getDoctorDashboard } from "@/features/doctor/queries";

export const metadata = { title: "داشبورد پزشک" };

export default async function DoctorDashboardPage() {
  const data = await getDoctorDashboard();

  const stats = [
    { label: "بیماران فعال", value: data.activePatients, icon: Users },
    {
      label: "نتایج در انتظار تفسیر",
      value: data.pendingResults,
      icon: Stethoscope,
    },
    {
      label: "درخواست‌های ویزیت",
      value: data.pendingVisitRequests,
      icon: Beaker,
    },
  ];

  return (
    <div>
      <PageHeader
        title="داشبورد"
        description="خلاصه بیماران و کارهای بالینی در انتظار."
        actions={
          <Button asChild size="sm">
            <Link href="/doctor/lab-orders/new">سفارش آزمایش جدید</Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {stat.value}
                </p>
              </div>
              <stat.icon
                className="size-8 text-muted-foreground/40"
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-labelledby="recent-orders-heading">
        <h2 id="recent-orders-heading" className="mb-3 text-lg font-semibold">
          سفارش‌های اخیر
        </h2>
        {data.recentLabOrders.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="سفارش آزمایشی ثبت نشده است"
            description="برای شروع، از لیست بیماران یک بیمار انتخاب و سفارش آزمایش ایجاد کنید."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/doctor/patients">مشاهده بیماران</Link>
              </Button>
            }
          />
        ) : (
          <div>{/* جدول سفارش‌ها — فاز ۴ پس از Contract */}</div>
        )}
      </section>
    </div>
  );
}
