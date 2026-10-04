import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorNotifications } from "@/features/notifications/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";

export const metadata = { title: "اعلان‌ها" };

function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default async function DoctorNotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const notifications = await getDoctorNotifications(user.id);
  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <>
      <PageHeader
        title="اعلان‌ها"
        description={unread ? `${unread} اعلان خوانده‌نشده دارید.` : "همه اعلان‌ها خوانده شده‌اند."}
        actions={unread ? <form action={markAllNotificationsRead}><Button type="submit" variant="outline">خواندن همه</Button></form> : null}
      />

      {notifications.length === 0 ? <EmptyState title="اعلانی وجود ندارد." description="اعلان‌های مرتبط با بیماران و نتایج آزمایش اینجا نمایش داده می‌شوند." /> : <div className="space-y-3">{notifications.map((item) => <article key={item.id} className={`rounded-xl border bg-card p-4 ${item.is_read ? "" : "border-primary/30 bg-primary/[0.02]"}`}><div className="flex items-start justify-between gap-4"><div><h2 className="font-medium">{item.title}</h2>{item.body ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p> : null}<p className="mt-3 text-xs text-muted-foreground">{formatDate(item.created_at)}</p></div>{item.is_read ? <span className="text-xs text-muted-foreground">خوانده‌شده</span> : <form action={markNotificationRead}><input type="hidden" name="id" value={item.id} /><Button type="submit" size="sm" variant="ghost">علامت به‌عنوان خوانده‌شده</Button></form>}</div></article>)}</div>}
    </>
  );
}
