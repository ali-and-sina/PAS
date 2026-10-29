import Link from "next/link";
import { ClipboardList, Bell, ArrowLeft } from "lucide-react";
import DashboardWelcome from "@/components/shared/DashboardWelcome";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OrderQueueTable from "@/features/lab-orders/components/OrderQueueTable";
import LabDashboardStats from "@/features/lab/components/LabDashboardStats";
import { getLabDashboard } from "@/features/lab/queries";

export const metadata = { title: "داشبورد آزمایشگاه" };
export const dynamic = "force-dynamic";

export default async function LabDashboardPage() {
  const data = await getLabDashboard();
  const recentOrders = data.recentOrders || [];

  return (
    <div className="space-y-6">
      <DashboardWelcome
        eyebrow="گردش‌کار آزمایشگاه"
        title="داشبورد آزمایشگاه"
        description="فرآیند آزمایشگاه را از پذیرش درخواست تا نهایی‌سازی نتیجه در یک نگاه مدیریت کنید."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/lab/dispatches">درخواست‌های ارجاع‌شده</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/lab/home-collection">نمونه‌گیری در منزل</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/lab/orders">صف پذیرش</Link></Button>
          </div>
        }
      />

      <LabDashboardStats data={data} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">پذیرش‌های اخیر</h2>
                <p className="mt-1 text-sm text-muted-foreground">مواردی که بیشترین احتمال اقدام بعدی دارند.</p>
              </div>
              <Link href="/lab/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                همه پذیرش‌ها
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {recentOrders.length ? (
              <OrderQueueTable orders={recentOrders} />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="صف پذیرش خالی است"
                description="پذیرش‌های ثبت‌شده برای ورود نتیجه در این بخش نمایش داده می‌شوند. درخواست‌های تازه در صفحه درخواست‌های ارجاع‌شده هستند."
                action={{ label: "مشاهده صف پذیرش", href: "/lab/orders" }}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
                  <Bell className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">اعلان‌های آزمایشگاه</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">رویدادهای مهم و پذیرش‌های نیازمند اقدام.</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href="/lab/notifications">مشاهده اعلان‌ها</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">اصل عملیاتی</p>
              <p className="mt-2 text-sm font-medium leading-6">ورود نتیجه باید سریع، دقیق و بدون اطلاعات بالینی غیرضروری باشد.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">تفسیر و تصمیم پزشکی در اختیار پزشک باقی می‌ماند.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
