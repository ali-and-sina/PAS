import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, FileText, Pill, UserRound } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientHealthRecord } from "@/features/patient/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const sexLabels = {
  male: "مرد",
  female: "زن",
};

export default async function PatientHealthRecordPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const record = await getPatientHealthRecord();
  if (!record) redirect("/login");

  const profile = record.patientProfile;

  return (
    <div>
      <PageHeader
        title="سوابق سلامت"
        description="اطلاعات پایه، پزشکان مرتبط و خلاصه سوابق ثبت‌شده شما."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/patient/trends">روند آزمایش‌ها</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound className="size-4" aria-hidden="true" />
              اطلاعات پایه
            </h2>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">نام و نام خانوادگی</dt>
                <dd className="mt-1 text-sm font-medium">
                  {record.profile.full_name || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">کد ملی</dt>
                <dd className="mt-1 text-sm font-medium" dir="ltr">
                  {record.profile.national_id || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">موبایل</dt>
                <dd className="mt-1 text-sm font-medium" dir="ltr">
                  {record.profile.phone || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">تاریخ تولد</dt>
                <dd className="mt-1 text-sm font-medium">
                  {profile?.date_of_birth || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">جنسیت</dt>
                <dd className="mt-1 text-sm font-medium">
                  {sexLabels[profile?.sex] || profile?.sex || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">گروه خونی</dt>
                <dd className="mt-1 text-sm font-medium">
                  {profile?.blood_type || "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound className="size-4" aria-hidden="true" />
              پزشکان مرتبط
            </h2>

            {record.doctors.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={UserRound}
                  title="پزشک مرتبطی وجود ندارد"
                  description="هنوز رابطه فعالی با پزشک برای شما ثبت نشده است."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {record.doctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{doctor.doctor_name}</p>
                      <span className="text-xs text-muted-foreground">
                        {doctor.status === "active"
                          ? "فعال"
                          : "در انتظار تأیید"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {doctor.relationship_type === "primary_care"
                        ? "پزشک اصلی"
                        : doctor.relationship_type === "consulting"
                          ? "پزشک مشاور"
                          : "ارتباط موردی"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileText className="size-4" aria-hidden="true" />
              آخرین نتایج
            </h2>

            {record.recentReports.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={FileText}
                  title="نتیجه‌ای ندارید"
                  description="نتایج نهایی آزمایش‌ها بعد از ثبت در این بخش نمایش داده می‌شوند."
                  action={{
                    label: "مشاهده آزمایش‌ها",
                    href: "/patient/results",
                  }}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {record.recentReports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/patient/results/${report.id}`}
                    className="block rounded-lg border p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">گزارش آزمایش</p>
                      <span className="text-xs text-muted-foreground">
                        {report.status === "amended" ? "اصلاح‌شده" : "نهایی"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(report.created_at)} · {report.doctor_name}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Pill className="size-4" aria-hidden="true" />
              آخرین نسخه‌ها
            </h2>

            {record.recentPrescriptions.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={Pill}
                  title="نسخه‌ای ندارید"
                  description="نسخه‌های ثبت‌شده توسط پزشکان در این بخش نمایش داده می‌شوند."
                  action={{
                    label: "مشاهده نسخه‌ها",
                    href: "/patient/prescriptions",
                  }}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {record.recentPrescriptions.map((prescription) => (
                  <Link
                    key={prescription.id}
                    href="/patient/prescriptions"
                    className="block rounded-lg border p-4 hover:bg-muted/30"
                  >
                    <p className="font-medium">
                      {prescription.doctor_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(prescription.issued_at)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {profile?.emergency_contact_name ? (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardList className="size-4" aria-hidden="true" />
              تماس اضطراری
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="text-sm">
                <span className="text-muted-foreground">نام: </span>
                {profile.emergency_contact_name}
              </p>
              <p className="text-sm" dir="ltr">
                <span className="text-muted-foreground">موبایل: </span>
                {profile.emergency_contact_phone || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
