import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = {
  title: "اعلان‌ها",
};

export default async function NotificationsPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="اعلان‌ها"
        description="اطلاع‌رسانی‌های مربوط به نتایج، تفسیرها و نسخه‌های شما."
      />

      {/*
        اینجا لیست اعلان‌ها قرار می‌گیرد.
        کامپوننت مورد انتظار: <NotificationsList userId={user.id} />
        داده از جدول: notifications
        فیلتر: recipient_id = user.id
        مرتب‌سازی: created_at DESC
        قابلیت: mark as read
        Polling: 45s از Provider سراسری
      */}
      <EmptyState
        title="اعلان جدیدی وجود ندارد"
        description="هر اعلان جدیدی که مرتبط با نتایج، تفسیرها یا نسخه‌های شما باشد، در این بخش نمایش داده می‌شود."
        icon={Bell}
      />
    </div>
  );
}
