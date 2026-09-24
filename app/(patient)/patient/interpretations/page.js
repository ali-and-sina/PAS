import { redirect } from "next/navigation";
import { Stethoscope } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = {
  title: "تفسیرهای پزشک",
};

export default async function InterpretationsPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تفسیرهای پزشک"
        description="تفسیرهای ثبت‌شده توسط پزشکان بر اساس نتایج آزمایش‌های شما."
      />

      {/*
        اینجا لیست تفسیرهای پزشک قرار می‌گیرد.
        کامپوننت مورد انتظار: <InterpretationsList patientId={user.id} />
        داده از جدول: doctor_interpretations
        فیلتر: is_visible_to_patient = true
        مرتب‌سازی: created_at DESC
      */}
      <EmptyState
        title="هنوز تفسیری ثبت نشده است"
        description="پس از بررسی نتایج آزمایش توسط پزشک، تفسیرها در این بخش نمایش داده می‌شوند."
        icon={Stethoscope}
      />
    </div>
  );
}
