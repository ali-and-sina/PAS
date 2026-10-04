import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientReports } from "@/features/lab-results/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusLabel(status) {
  return status === "amended" ? "اصلاح‌شده" : "نهایی";
}

export default async function PatientResultsPage() {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const reports = await getPatientReports(patientId);

  return (
    <div>
      <PageHeader
        title="نتایج آزمایش‌ها"
        description="گزارش‌های آزمایشگاهی نهایی‌شده در پرونده شما."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="هنوز نتیجه‌ای ثبت نشده است"
          description="نتایج آزمایش پس از نهایی‌شدن توسط آزمایشگاه در این بخش نمایش داده می‌شوند."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/patient/results/${report.id}`}
              className="rounded-xl border bg-card p-5 transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <FileText
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  {statusLabel(report.status)}
                </span>
              </div>

              <h2 className="mt-4 font-semibold">
                گزارش آزمایش
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(report.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
