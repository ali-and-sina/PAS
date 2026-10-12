import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminLaboratory } from "@/features/admin/queries";
import { getOrganizationTypeLabel } from "@/lib/constants/status";

export const metadata = { title: "جزئیات آزمایشگاه" };

function Field({ label, value, dir }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p dir={dir} className="font-medium">{value || "—"}</p>
    </div>
  );
}

export default async function AdminLaboratoryDetailPage({ params }) {
  const { laboratoryId } = await params;
  const laboratory = await getAdminLaboratory(laboratoryId);

  if (!laboratory) {
    return (
      <EmptyState
        icon={Building2}
        title="آزمایشگاه پیدا نشد"
        description="این حساب آزمایشگاه وجود ندارد یا دیگر در دسترس نیست."
        action={{ href: "/admin/laboratories", label: "بازگشت به آزمایشگاه‌ها" }}
      />
    );
  }

  const organization = laboratory.organization;

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization?.name || "آزمایشگاه بدون نام"}
        description="جزئیات حساب و سازمان آزمایشگاهی."
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/laboratories"><ArrowRight aria-hidden="true" />بازگشت</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>اطلاعات حساب</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Field label="نام مسئول حساب" value={laboratory.full_name} />
          <Field label="شماره موبایل" value={laboratory.phone} dir="ltr" />
          <Field label="شماره مجوز" value={laboratory.license_number} dir="ltr" />
          <Field label="نوع سازمان" value={getOrganizationTypeLabel(organization?.type)} />
          <Field label="شناسه سازمان" value={laboratory.organization_id} dir="ltr" />
          <Field label="تاریخ ایجاد حساب" value={new Date(laboratory.created_at).toLocaleDateString("fa-IR")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>سازمان</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Field label="نام سازمان" value={organization?.name} />
          <Field label="نوع" value={getOrganizationTypeLabel(organization?.type)} />
          <Field label="شماره مجوز سازمان" value={organization?.license_number} dir="ltr" />
        </CardContent>
      </Card>
    </div>
  );
}
