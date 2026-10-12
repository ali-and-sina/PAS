import { Bell } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LabNotificationList from "@/features/lab/components/LabNotificationList";
import { getSessionUser } from "@/lib/auth/server";
import { getLaboratoryNotifications } from "@/features/notifications/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "اعلان‌های آزمایشگاه" };
export const dynamic = "force-dynamic";

export default async function LabNotificationsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role !== "laboratory") return null;

  const params = await searchParams;
  const result = await getLaboratoryNotifications(user.id, { page: params?.page ?? 1 });
  const data = result.items;

  return (
    <div>
      <PageHeader title="اعلان‌ها" description={result.unreadCount ? `${result.unreadCount} اعلان خوانده‌نشده دارید؛ در هر صفحه حداکثر ${result.pagination.pageSize} اعلان نمایش داده می‌شود.` : `در حال حاضر اعلان خوانده‌نشده‌ای ندارید؛ در هر صفحه حداکثر ${result.pagination.pageSize} اعلان نمایش داده می‌شود.`} />
      {!data?.length ? (
        <EmptyState icon={Bell} title="اعلانی ندارید" description="اعلان‌های جدید در اینجا نمایش داده می‌شوند." />
      ) : (
        <LabNotificationList notifications={data} />
      )}
      <Pagination pathname="/lab/notifications" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
