import { redirect } from "next/navigation";
import { Pill } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = {
  title: "نسخه‌ها",
};

export default async function PrescriptionsPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="نسخه‌ها"
        description="نسخه‌های صادرشده توسط پزشکان برای شما."
      />

      {/*
        اینجا لیست نسخه‌ها قرار می‌گیرد.
        کامپوننت مورد انتظار: <PrescriptionsList patientId={user.id} />
        داده از جدول: prescriptions + prescription_items
        فیلتر: patient_id = user.id
        مرتب‌سازی: issued_at DESC
        نمایش: وضعیت (active / completed / cancelled) + داروها
      */}
      <EmptyState
        title="هنوز نسخه‌ای صادر نشده است"
        description="پس از صدور نسخه توسط پزشک، در این بخش نمایش داده می‌شود."
        icon={Pill}
      />
    </div>
  );
}
