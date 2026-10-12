"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell, FileCheck2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getHref(notification) {
  if (notification.related_entity_type === "diagnostic_report" && notification.related_entity_id) {
    return `/doctor/interpretations?report=${notification.related_entity_id}`;
  }
  if (notification.related_entity_type === "lab_order" && notification.related_entity_id) {
    return `/doctor/lab-orders/${notification.related_entity_id}`;
  }
  return "/doctor/notifications";
}

export default function PhysicianNotificationList({ notifications }) {
  const [pending, startTransition] = useTransition();
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={pending}>
            {pending ? "در حال به‌روزرسانی..." : "خواندن همه"}
          </Button>
        </div>
      ) : null}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">اعلان جدیدی ندارید</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">اعلان‌های مرتبط با نتایج، پیگیری و فعالیت بیماران اینجا نمایش داده می‌شوند.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article key={notification.id} className={`rounded-xl border p-4 ${notification.is_read ? "bg-card" : "bg-accent/30"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${notification.is_read ? "bg-muted text-muted-foreground" : "bg-accent text-primary"}`}>
                  <FileCheck2 className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-medium">{notification.title}</h2>
                      {notification.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p> : null}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDate(notification.created_at)}</time>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={getHref(notification)} className="text-xs text-primary hover:underline">مشاهده مورد مرتبط</Link>
                    {!notification.is_read ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={notification.id} />
                        <button type="submit" className="text-xs text-muted-foreground hover:text-foreground hover:underline">علامت‌گذاری به‌عنوان خوانده‌شده</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
