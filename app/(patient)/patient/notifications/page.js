import { Bell, Check } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientNotifications } from "@/features/notifications/queries";
import Pagination from "@/components/shared/Pagination";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

export default async function PatientNotificationsPage({ searchParams }) {
  const params = await searchParams;
  const result = await getPatientNotifications({ page: params?.page ?? 1 });
  const notifications = result.items;
  const unreadCount = result.unreadCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="اعلان‌ها"
        description={unreadCount ? `${unreadCount} اعلان خوانده‌نشده دارید.` : "اعلان خوانده‌نشده‌ای ندارید."}
        actions={
          unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline">
                <Check aria-hidden="true" />
                علامت‌گذاری همه به‌عنوان خوانده‌شده
              </Button>
            </form>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={Bell} title="اعلانی ندارید" description="وقتی رویداد مهمی برای پرونده شما ثبت شود، اینجا نمایش داده می‌شود." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={!notification.is_read ? "border-primary/25" : undefined}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="mt-1 shrink-0">
                    <span className={`block size-2.5 rounded-full ${notification.is_read ? "bg-border" : "bg-primary"}`} aria-label={notification.is_read ? "خوانده شده" : "خوانده نشده"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <h2 className="font-medium">{notification.title}</h2>
                      <time className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</time>
                    </div>
                    {notification.message && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{notification.message}</p>
                    )}
                    {!notification.is_read && (
                      <form action={markNotificationRead} className="mt-3">
                        <input type="hidden" name="id" value={notification.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          <Check aria-hidden="true" />
                          خوانده شد
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination pathname="/patient/notifications" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
