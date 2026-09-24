import { redirect } from "next/navigation";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import StatusBadge from "@/components/shared/StatusBadge";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "نتایج آزمایش",
};

export default async function ResultsPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  /*
    اینجا باید لیست diagnostic_reports بیمار خوانده شود.
    کامپوننت مورد انتظار: getPatientReports({ patientId: user.id, page, pageSize })
    منبع: features/lab-results/queries.js

    خروجی مورد انتظار:
    {
      items: [{
        id,
        observed_at,
        observed_at_display,
        laboratory_name,
        test_count,
        out_of_range_count,
        has_superseded,
      }],
      total, page, pageSize
    }

    فیلتر: patient_id = user.id
    مرتب‌سازی: observed_at DESC
    فقط status = 'final'
    صفحه‌بندی: 20 آیتم در هر صفحه
  */
  const reports = [];
  const totalPages = 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="نتایج آزمایش"
        description="تمام نتایج آزمایش‌های ثبت‌شده برای شما، به ترتیب جدیدترین."
      />

      {reports.length === 0 ? (
        <EmptyState
          title="هنوز نتیجه‌ای برای نمایش وجود ندارد"
          description="پس از انجام آزمایش و ثبت نتیجه توسط آزمایشگاه، نتایج در این بخش نمایش داده می‌شوند."
          icon={FlaskConical}
        />
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center pt-2">
              {/*
                کامپوننت مورد انتظار: <Pagination totalPages={totalPages} currentPage={page} />
              */}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param {{ report: {
 *   id: string,
 *   observed_at_display: string,
 *   laboratory_name?: string,
 *   test_count: number,
 *   out_of_range_count: number,
 *   has_superseded?: boolean,
 * } }} props
 */
function ReportCard({ report }) {
  return (
    <Link
      href={`/patient/results/${report.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">گزارش آزمایش</p>
            {report.has_superseded && (
              <StatusBadge variant="superseded" label="اصلاح‌شده" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {report.observed_at_display}
            {report.laboratory_name ? ` — ${report.laboratory_name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{report.test_count} تست</span>
          {report.out_of_range_count > 0 && (
            <StatusBadge
              variant="high"
              label={`${report.out_of_range_count} خارج از محدوده`}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
