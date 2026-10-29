import Link from "next/link";
import { ArrowLeft, Building2, Clock3, Stethoscope, Users } from "lucide-react";
import DashboardWelcome from "@/components/shared/DashboardWelcome";
import StatCard from "@/components/shared/StatCard";
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
      <DashboardWelcome eyebrow="فضای مدیریت" title="مدیریت سامانه" description="نمای کلی کاربران، تأیید پزشکان و مدیریت آزمایشگاه‌ها." actions={<Button asChild><Link href="/admin/doctors/new">ثبت پزشک جدید</Link></Button>} />
      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="sr-only">نمای کلی</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {stats.map(({ key, label, icon: Icon }) => (
            <StatCard key={key} label={label} value={overview[key]} icon={Icon} href={key === "patients" ? "/admin/users" : key === "laboratories" ? "/admin/laboratories" : "/admin/doctors"} tone={key === "pendingDoctors" ? "warning" : "info"} />
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
