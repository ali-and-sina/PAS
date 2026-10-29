"use client";

import { formatPersianDateTime } from "@/lib/utils/date-time";

import { useTransition } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";



const TYPE_LABELS = {
  new_result: "نتیجه جدید",
  requested_test_completed: "آزمایش تکمیل شد",
  patient_action_required: "نیازمند اقدام",
};

export default function LabNotificationList({ notifications = [] }) {
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
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-sm font-medium">{unreadCount} اعلان خوانده‌نشده</p>
            <p className="mt-1 text-xs text-muted-foreground">اعلان‌های مهم مربوط به کار آزمایشگاه را مرور کنید.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pending} loading={pending} onClick={markAll}>
            <CheckCheck className="size-4" aria-hidden="true" />
            {pending ? "در حال به‌روزرسانی..." : "خواندن همه"}
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={cn(
              "rounded-xl border bg-card p-4",
              !notification.is_read && "border-primary/30 bg-accent/10",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bell className="size-4 text-primary" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {TYPE_LABELS[notification.type] || "اعلان"}
                    </span>
                    <h2 className="mt-1 font-medium">{notification.title}</h2>
                  </div>

                  {!notification.is_read ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={notification.id} />
                      <Button type="submit" size="sm" variant="ghost" title="علامت‌گذاری به‌عنوان خوانده‌شده">
                        <Check className="size-4" aria-hidden="true" />
                        خوانده شد
                      </Button>
                    </form>
                  ) : null}
                </div>

                {notification.body ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{notification.body}</p>
                ) : null}

                <time className="mt-3 block text-xs text-muted-foreground">{formatPersianDateTime(notification.created_at)}</time>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
