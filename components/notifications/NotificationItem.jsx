import { Bell, Check } from "lucide-react";
import { markNotificationRead } from "@/features/notifications/actions";
import { Button } from "@/components/ui/button";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default function NotificationItem({ notification }) {
  return (
    <article className={`rounded-xl border bg-card p-4 ${notification.is_read ? "" : "border-primary/30"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{notification.title}</h2>
          {notification.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
        </div>
        {!notification.is_read ? (
          <form action={markNotificationRead}>
            <input type="hidden" name="id" value={notification.id} />
            <Button type="submit" variant="ghost" size="sm" title="خوانده شد"><Check className="size-4" aria-hidden="true" /></Button>
          </form>
        ) : <Bell className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />}
      </div>
    </article>
  );
}
