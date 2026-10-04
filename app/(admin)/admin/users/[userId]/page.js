import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminUser } from "@/features/admin/queries";

const roleLabels = {
  patient: "بیمار",
  doctor: "پزشک",
  laboratory: "آزمایشگاه",
  admin: "مدیر",
};

function Field({ label, value, dir }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p dir={dir} className="font-medium">{value || "—"}</p>
    </div>
  );
}

export const metadata = { title: "جزئیات کاربر" };

export default async function AdminUserDetailPage({ params }) {
  const { userId } = await params;
  const user = await getAdminUser(userId);

  if (!user) {
    return (
      <EmptyState
        icon={UserRound}
        title="کاربر پیدا نشد"
        description="این حساب وجود ندارد یا دیگر در دسترس نیست."
        action={{ href: "/admin/users", label: "بازگشت به کاربران" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.full_name || "کاربر بدون نام"}
        description={`جزئیات حساب ${roleLabels[user.role] || user.role}.`}
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/users"><ArrowRight aria-hidden="true" />بازگشت</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>اطلاعات پایه</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Field label="نام و نام خانوادگی" value={user.full_name} />
          <Field label="نقش" value={roleLabels[user.role] || user.role} />
          <Field label="شماره موبایل" value={user.phone} dir="ltr" />
          <Field label="شناسه کاربر" value={user.id} dir="ltr" />
          <Field label="تاریخ ایجاد" value={new Date(user.created_at).toLocaleDateString("fa-IR")} />
        </CardContent>
      </Card>

      {user.role === "patient" && (
        <Card>
          <CardHeader><CardTitle>پروفایل بیمار</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="کد ملی" value={user.national_id} dir="ltr" />
            <Field label="جنسیت" value={user.patient?.sex} />
            <Field label="تاریخ تولد" value={user.patient?.date_of_birth} dir="ltr" />
            <Field label="گروه خونی" value={user.patient?.blood_type} dir="ltr" />
          </CardContent>
        </Card>
      )}

      {user.role === "doctor" && user.doctor && (
        <Card>
          <CardHeader><CardTitle>پروفایل پزشک</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="شماره نظام پزشکی" value={user.doctor.medical_license_number} dir="ltr" />
            <Field label="تخصص" value={user.doctor.specialty} />
            <Field label="وضعیت تأیید" value={user.doctor.is_verified ? "تأییدشده" : "در انتظار تأیید"} />
          </CardContent>
        </Card>
      )}

      {user.role === "laboratory" && user.laboratory && (
        <Card>
          <CardHeader><CardTitle>پروفایل آزمایشگاه</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="شماره مجوز" value={user.laboratory.license_number} dir="ltr" />
            <Field label="نام سازمان" value={user.laboratory.organizations?.name} />
            <Field label="نوع سازمان" value={user.laboratory.organizations?.type} />
          </CardContent>
        </Card>
      )}

      {user.role === "admin" && user.admin && (
        <Card>
          <CardHeader><CardTitle>پروفایل مدیر</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="کد پرسنلی" value={user.admin.personnel_code} dir="ltr" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
