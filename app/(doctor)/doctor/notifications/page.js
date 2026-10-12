import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorNotifications } from "@/features/notifications/queries";
import Pagination from "@/components/shared/Pagination";
import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationReviewed,
} from "@/features/notifications/actions";

export const metadata = { title: "اعلان‌ها" };
export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getEntityHref(item) {
  if (item.relatedPatientId) return `/doctor/patients/${item.relatedPatientId}`;
  if (!item.related_entity_id) return "/doctor/notifications";
  switch (item.related_entity_type) {
    case "diagnostic_report": return `/doctor/interpretations?report=${item.related_entity_id}`;
    case "lab_order": return `/doctor/lab-orders/${item.related_entity_id}`;
    case "follow_up": return `/doctor/follow-ups?id=${item.related_entity_id}`;
    case "visit": return "/doctor/patients";
    case "voice_note": return "/doctor/patients";
    case "doctor_note": return "/doctor/notes";
    default: return "/doctor/notifications";
  }
}

function getStatusLabel(item) {
  if (item.status === "reviewed") return "بررسی‌شده";
  if (item.status === "read" || item.is_read) return "خوانده‌شده";
  return "خوانده‌نشده";
}

export default async function DoctorNotificationsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) redirect("/doctor/dashboard");

  const params = await searchParams;
  const page = params?.page ?? 1;
  const result = await getDoctorNotifications(user.id, { page });
  const notifications = result.items;
  const unread = result.unreadCount;

  return (
    <div className="space-y-5">
      <PageHeader
        title="اعلان‌ها"
        description={unread ? `${unread} اعلان خوانده‌نشده دارید.` : "اعلان خوانده‌نشده‌ای ندارید."}
        actions={unread ? <form action={markAllNotificationsRead}><Button type="submit" variant="outline">خواندن همه</Button></form> : null}
      />

      {notifications.length === 0 ? (
        <EmptyState title="اعلانی وجود ندارد." description="اعلان‌های مرتبط با بیماران، پیگیری‌ها و نتایج آزمایش اینجا نمایش داده می‌شوند." />
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <article key={item.id} className={`rounded-xl border bg-card p-4 ${item.status === "unread" ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{item.title}</h2>
                    <span className={`rounded-full px-2 py-1 text-xs ${item.status === "reviewed" ? "bg-emerald-50 text-emerald-700" : item.is_read ? "bg-muted text-muted-foreground" : "bg-accent text-primary"}`}>{getStatusLabel(item)}</span>
                  </div>
                  {item.body ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p> : null}
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link href={getEntityHref(item)} className="text-sm text-primary hover:underline">مشاهده مورد مرتبط</Link>
                    {!item.is_read ? <form action={markNotificationRead}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">علامت به‌عنوان خوانده‌شده</button></form> : null}
                    {item.status !== "reviewed" ? <form action={markNotificationReviewed}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">علامت به‌عنوان بررسی‌شده</button></form> : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination pathname="/doctor/notifications" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
