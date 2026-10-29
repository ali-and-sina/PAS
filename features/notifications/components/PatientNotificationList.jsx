"use client";

import { formatPersianDateTime } from "@/lib/utils/date-time";

import { useTransition } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import { Button } from "@/components/ui/button";



export default function PatientNotificationList({ notifications }) {
  const [pending, startTransition] = useTransition();

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            loading={pending}
            onClick={markAll}
          >
            {pending ? "در حال به‌روزرسانی..." : "خواندن همه"}
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`rounded-xl border p-4 ${
              notification.is_read
                ? "bg-card"
                : "bg-muted/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {!notification.is_read ? (
                <span
                  className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                  aria-label="خوانده‌نشده"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="font-medium">
                    {notification.title}
                  </h2>

                  {!notification.is_read ? (
                    <form action={markNotificationRead}>
                      <input
                        type="hidden"
                        name="id"
                        value={notification.id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        علامت‌گذاری به‌عنوان خوانده‌شده
                      </Button>
                    </form>
                  ) : null}
                </div>

                {notification.body ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}

                <time className="mt-3 block text-xs text-muted-foreground">
                  {formatPersianDateTime(notification.created_at)}
                </time>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
