import Link from "next/link";
import { ArrowLeft, Building2, Clock3, Stethoscope, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/features/admin/queries";

export const metadata = { title: "مدیریت سیستم" };

const stats = [
  { key: "patients", label: "بیماران", icon: Users },
  { key: "doctors", label: "پزشکان", icon: Stethoscope },
  { key: "laboratories", label: "آزمایشگاه‌ها", icon: Building2 },
  { key: "pendingDoctors", label: "پزشکان در انتظار تأیید", icon: Clock3 },
];

export default async function AdminHomePage() {
  const overview = await getAdminOverview();

  return (
    <div className="space-y-6">
      <PageHeader title="مدیریت سیستم" description="نمای کلی کاربران و وضعیت حساب‌های سازمانی." />
      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="sr-only">نمای کلی</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ key, label, icon: Icon }) => (
            <Card key={key}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold tracking-tight">{overview[key]}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card>
        <CardHeader><CardTitle>عملیات سریع</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button asChild variant="outline" className="justify-between"><Link href="/admin/doctors">مدیریت پزشکان <ArrowLeft aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="justify-between"><Link href="/admin/laboratories">مدیریت آزمایشگاه‌ها <ArrowLeft aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="justify-between"><Link href="/admin/users">مشاهده کاربران <ArrowLeft aria-hidden="true" /></Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
