import { Building2, ShieldCheck, Stethoscope } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatientAccessList } from "@/features/patient/queries";
import { getOrganizationTypeLabel } from "@/lib/constants/status";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export default async function PatientAccessPage() {
  const data = await getPatientAccessList();

  return (
    <div className="space-y-6">
      <PageHeader
        title="دسترسی به پرونده"
        description="افراد و مراکزی که بر اساس روابط و درخواست‌های آزمایش ثبت‌شده با پرونده شما مرتبط هستند."
      />

      <div className="rounded-2xl border border-primary/15 bg-accent/50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-7 text-muted-foreground">
            دسترسی آزمایشگاه‌ها در این نسخه بر اساس درخواست‌های آزمایش ثبت‌شده نمایش داده می‌شود؛ این صفحه به‌تنهایی به معنی وجود یک مدل مستقل مجوز دائمی نیست.
          </p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" aria-hidden="true" />
              پزشکان مرتبط
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.doctors.length === 0 ? (
              <EmptyState title="پزشک مرتبطی پیدا نشد" description="رابطه فعال بیمار و پزشک در حال حاضر ثبت نشده است." />
            ) : (
              <div className="space-y-3">
                {data.doctors.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <p className="font-medium">
                      {item.doctor?.full_name ? `دکتر ${item.doctor.full_name}` : "پزشک"}
                    </p>
                    {item.doctor?.specialty && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.doctor.specialty}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      مبنا: رابطه فعال بیمار و پزشک
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" aria-hidden="true" />
              آزمایشگاه‌های مرتبط
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.laboratories.length === 0 ? (
              <EmptyState title="آزمایشگاه مرتبطی پیدا نشد" description="هنوز درخواست آزمایش مرتبطی در پرونده شما ثبت نشده است." />
            ) : (
              <div className="space-y-3">
                {data.laboratories.map((item) => (
                  <div key={item.laboratory_id} className="rounded-xl border p-4">
                    <p className="font-medium">{item.organization?.name || item.laboratory?.full_name || "آزمایشگاه"}</p>
                    {item.organization?.type && (
                      <p className="mt-1 text-xs text-muted-foreground">{getOrganizationTypeLabel(item.organization.type)}</p>
                    )}
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>تعداد درخواست آزمایش: {item.order_count}</span>
                      <span>آخرین درخواست آزمایش: {formatDate(item.latest_ordered_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
