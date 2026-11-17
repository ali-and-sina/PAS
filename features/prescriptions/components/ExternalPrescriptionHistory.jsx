import { CalendarDays, Clock3, FileCheck2, Hash } from "lucide-react";

import Pagination from "@/components/shared/Pagination";
import SectionCard from "@/components/shared/SectionCard";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatPersianDateTime } from "@/lib/utils/date-time";

const PROVIDER_LABELS = Object.freeze({
  tamin: "تأمین اجتماعی",
  ihio: "بیمه سلامت",
  diagnostic_center: "مرکز تشخیصی",
});

function getProviderLabel(providerKey) {
  return PROVIDER_LABELS[providerKey] || "سامانهٔ بیرونی";
}

function ExternalPrescriptionCard({ record }) {
  return (
    <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold">
              {record.title || "نسخهٔ دریافتی"}
            </h3>
            <StatusBadge label="دریافت‌شده" />
          </div>
          <p className="text-sm text-muted-foreground">{getProviderLabel(record.provider_key)}</p>
          {record.patient_name ? (
            <p className="text-sm text-muted-foreground">
              بیمار: <span className="font-medium text-foreground">{record.patient_name}</span>
            </p>
          ) : null}
        </div>
      </div>

      <dl className="grid min-w-0 gap-3 rounded-lg bg-muted/30 p-3 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">زمان ثبت نسخه در مبدأ</dt>
            <dd className="mt-1 break-words">{formatPersianDateTime(record.occurred_at)}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">زمان دریافت در پاس</dt>
            <dd className="mt-1 break-words">{formatPersianDateTime(record.received_at)}</dd>
          </div>
        </div>
        {record.external_record_id ? (
          <div className="flex min-w-0 items-start gap-2 sm:col-span-2">
            <Hash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">شناسهٔ نسخه در سامانهٔ مبدأ</dt>
              <dd className="mt-1 break-all font-mono text-xs" dir="ltr">{record.external_record_id}</dd>
            </div>
          </div>
        ) : null}
      </dl>

      {record.summary ? (
        <details className="group rounded-lg border px-3 py-2.5">
          <summary className="min-h-8 cursor-pointer text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            مشاهدهٔ توضیحات ارسالی سامانه
          </summary>
          <p className="mt-2 whitespace-pre-line break-words border-t pt-3 text-sm leading-7 text-muted-foreground">
            {record.summary}
          </p>
        </details>
      ) : null}
    </article>
  );
}

export default function ExternalPrescriptionHistory({
  items = [],
  pagination,
  pathname,
  query = {},
}) {
  return (
    <SectionCard
      title="نسخه‌های دریافتی از سامانه‌های بیرونی"
      description="این نسخه‌ها از نسخه‌هایی که پزشک در خود پاس ثبت می‌کند جدا نگهداری می‌شوند."
      action={
        items.length && pagination
          ? <StatusBadge label={`${pagination.totalCount.toLocaleString("fa-IR")} نسخه`} />
          : null
      }
    >
      {items.length ? (
        <div className="space-y-3">
          {items.map((record) => (
            <ExternalPrescriptionCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/20 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card text-primary">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">نسخه‌ای برای نمایش وجود ندارد.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              نسخه‌های دریافتی از سامانه‌های متصل، در صورت وجود و بر اساس سطح دسترسی مجاز، در این بخش نمایش داده می‌شوند.
            </p>
          </div>
        </div>
      )}

      {pagination ? (
        <div className="mt-4">
          <Pagination
            pathname={pathname}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            pageParam="externalPage"
            query={query}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
