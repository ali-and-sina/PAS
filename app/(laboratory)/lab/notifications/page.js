import { Bell } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import NotificationItem from "@/components/notifications/NotificationItem";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "اعلان‌های آزمایشگاه" };

export default async function LabNotificationsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, related_entity_type, related_entity_id, is_read, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <>
      <PageHeader title="اعلان‌ها" description="پیام‌ها و رویدادهای مرتبط با سفارش‌های آزمایشگاه." />
      {!data?.length ? (
        <EmptyState icon={Bell} title="اعلانی ندارید" description="اعلان‌های جدید در اینجا نمایش داده می‌شوند." />
      ) : (
        <div className="space-y-2">
          {data.map((notification) => <NotificationItem key={notification.id} notification={notification} />)}
        </div>
      )}
    </>
  );
}
