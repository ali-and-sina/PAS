import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientFollowUps } from "@/features/patient/queries";
import Pagination from "@/components/shared/Pagination";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "بدون تاریخ";
}

const STATUS = {
  pending: { label: "انجام نشده", icon: Clock3, variant: "neutral" },
  completed: { label: "انجام شد", icon: CheckCircle2, variant: "normal" },
  overdue: { label: "عقب‌افتاده", icon: CalendarClock, variant: "critical" },
  cancelled: { label: "لغو شده", icon: XCircle, variant: "neutral" },
};

export default async function PatientFollowUpsPage({ searchParams }) {
  const params = await searchParams;
  const result = await getPatientFollowUps({ page: params?.page ?? 1 });
  // The server defines the stable due-date order before applying pagination.
  // Sorting a single page by status here would break the global ordering across pages.
  const ordered = result.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="پیگیری‌ها"
        description="کارهایی که پزشک برای ادامه مسیر سلامت شما ثبت کرده است."
      />

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CheckCircle2}
              title="پیگیری فعالی ندارید"
              description="هر زمان پزشک برای شما پیگیری ثبت کند، در این بخش نمایش داده می‌شود."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ordered.map((followUp) => {
            const meta = STATUS[followUp.status] ?? STATUS.pending;
            const Icon = meta.icon;

            return (
              <Card key={followUp.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-5 text-primary" aria-hidden="true" />
                        <h2 className="font-semibold">{followUp.title}</h2>
                        <StatusBadge label={meta.label} variant={meta.variant} />
                      </div>
                      {followUp.description && (
                        <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">
                          {followUp.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                      <p className="text-xs text-muted-foreground">سررسید</p>
                      <p className="mt-1 font-medium">{formatDate(followUp.due_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination pathname="/patient/follow-ups" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
