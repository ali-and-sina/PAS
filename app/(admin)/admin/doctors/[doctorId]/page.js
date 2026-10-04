import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, UserRound } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DoctorVerificationActions from "@/components/admin/DoctorVerificationActions";
import { getAdminDoctor } from "@/features/admin/queries";

export const metadata = { title: "جزئیات پزشک" };

function Field({ label, value, dir }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p dir={dir} className="font-medium">{value || "—"}</p>
    </div>
  );
}

export default async function AdminDoctorDetailPage({ params }) {
  const { doctorId } = await params;
  const doctor = await getAdminDoctor(doctorId);

  if (!doctor) {
    return (
      <EmptyState
        icon={UserRound}
        title="پزشک پیدا نشد"
        description="این حساب پزشک وجود ندارد یا دیگر در دسترس نیست."
        action={{ href: "/admin/doctors", label: "بازگشت به پزشکان" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.full_name || "پزشک بدون نام"}
        description="جزئیات حساب و وضعیت تأیید پزشک."
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/doctors"><ArrowRight aria-hidden="true" />بازگشت</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {doctor.is_verified ? (
              <CheckCircle2 className="size-5 text-status-normal" aria-hidden="true" />
            ) : (
              <Clock3 className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
            وضعیت تأیید
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {doctor.is_verified
              ? `تأیید شده در ${doctor.verified_at ? new Date(doctor.verified_at).toLocaleDateString("fa-IR") : "—"}`
              : "این پزشک هنوز توسط مدیر تأیید نشده است."}
          </p>
          <DoctorVerificationActions
            doctorId={doctor.id}
            isVerified={doctor.is_verified}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>اطلاعات حساب</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Field label="نام و نام خانوادگی" value={doctor.full_name} />
          <Field label="شماره موبایل" value={doctor.phone} dir="ltr" />
          <Field label="شماره نظام پزشکی" value={doctor.medical_license_number} dir="ltr" />
          <Field label="تخصص" value={doctor.specialty} />
          <Field label="تاریخ ایجاد حساب" value={new Date(doctor.created_at).toLocaleDateString("fa-IR")} />
        </CardContent>
      </Card>
    </div>
  );
}
