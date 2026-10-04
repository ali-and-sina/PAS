import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import PatientNotificationList from "@/features/notifications/components/PatientNotificationList";
import { getPatientNotifications } from "@/features/notifications/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function PatientNotificationsPage() {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const notifications = await getPatientNotifications(patientId);

  return (
    <div>
      <PageHeader
        title="اعلان‌ها"
        description="پیام‌ها و رویدادهای مرتبط با پرونده شما."
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="اعلان جدیدی ندارید"
          description="هر زمان رویداد مهمی برای پرونده شما ایجاد شود، اینجا نمایش داده خواهد شد."
        />
      ) : (
        <PatientNotificationList notifications={notifications} />
      )}
    </div>
  );
}
