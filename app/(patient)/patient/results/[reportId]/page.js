import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "جزئیات نتیجه",
};

export default async function ResultDetailPage({ params }) {
  const { reportId } = await params;
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  /*
    اینجا باید یک Server Query برای دریافت diagnostic_reports زده شود.
    کامپوننت مورد انتظار: getDiagnosticReportForPatient({ reportId, patientId: user.id })
    منبع: features/lab-results/queries.js

    خروجی مورد انتظار:
    {
      id, observed_at, laboratory_name, superseded_at, supersedes_report_id,
      observations: [{ test_name, test_name_fa, value_numeric, unit, reference_min, reference_max, flag, is_superseded }],
      interpretation: { content, doctor_name, created_at } | null,
      has_pdf: boolean,
    }

    اگر Backend آماده نیست، فعلاً null برمی‌گردانیم.
  */
  const report = null;

  if (!report) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="نتیجه یافت نشد"
          description="این نتیجه وجود ندارد یا به آن دسترسی ندارید."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/patient/results">
                <ArrowRight className="size-4" />
                بازگشت به نتایج
              </Link>
            </Button>
          }
        />
        <EmptyState
          title="نتیجه‌ای برای نمایش وجود ندارد"
          description="ممکن است این نتیجه حذف شده باشد یا هنوز برای شما ثبت نشده باشد."
          icon={FileText}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <PageHeader
        title={report.title ?? "نتیجه آزمایش"}
        description={report.observed_at_display}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/patient/results">
              <ArrowRight className="size-4" />
              بازگشت به نتایج
            </Link>
          </Button>
        }
      />

      {/* ─── Meta Bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {report.laboratory_name && (
          <span>آزمایشگاه: {report.laboratory_name}</span>
        )}
        {report.superseded_at && (
          <StatusBadge variant="superseded" label="اصلاح‌شده" />
        )}
      </div>

      {report.superseded_at && (
        <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          این نتیجه بعداً اصلاح شده است. نتیجه فعلی معتبر است.
        </p>
      )}

      {/* ─── Results Table ───────────────────────────────── */}
      <section className="rounded-lg border">
        {/*
          کامپوننت مورد انتظار: <LabResultTable results={report.observations} />
          جدول با ستون‌های: Test | Value | Unit | Reference Range | Status
          Status با FlagBadge: normal / low / high / critical_low / critical_high
        */}
        <div className="border-b bg-muted/40 px-4 py-3">
          <h2 className="font-medium">نتایج آزمایش</h2>
        </div>
        <div className="p-4">
          <EmptyState
            title="نتیجه‌ای برای نمایش وجود ندارد"
            description="اطلاعات این گزارش در دسترس نیست."
            icon={FileText}
          />
        </div>
      </section>

      {/* ─── Doctor Interpretation ───────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">تفسیر پزشک</h2>
        <Separator />
        {report.interpretation ? (
          <div className="rounded-lg border bg-card p-4">
            {/*
              کامپوننت مورد انتظار: <DoctorInterpretationCard interpretation={report.interpretation} />
              نمایش: نام پزشک + تاریخ + متن
              در بلوک بصری متمایز از داده خام
            */}
          </div>
        ) : (
          <EmptyState
            title="هنوز تفسیری ثبت نشده است"
            description="پس از بررسی این نتیجه توسط پزشک، تفسیر در همین بخش نمایش داده می‌شود."
          />
        )}
      </section>

      {/* ─── PDF Attachment (only if exists) ────────────── */}
      {report.has_pdf && (
        <section className="space-y-3">
          <Separator />
          <Button asChild variant="outline" size="sm">
            <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4" />
              مشاهده PDF اصلی گزارش
            </a>
          </Button>
        </section>
      )}
    </div>
  );
}
