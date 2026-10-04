import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientObservations, getPatientReport } from "@/features/lab-results/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getValue(observation) {
  if (observation.value_numeric != null) {
    return observation.value_numeric;
  }

  if (observation.value_text != null) {
    return observation.value_text;
  }

  if (observation.value_boolean != null) {
    return observation.value_boolean ? "مثبت" : "منفی";
  }

  return "—";
}

function flagLabel(flag) {
  const labels = {
    normal: "طبیعی",
    low: "پایین",
    high: "بالا",
    critical_low: "بحرانی: پایین",
    critical_high: "بحرانی: بالا",
  };

  return labels[flag] || "—";
}

export default async function PatientReportPage({ params }) {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const { reportId } = await params;
  const report = await getPatientReport(reportId, patientId);

  if (!report) notFound();

  const observations = await getPatientObservations(
    patientId,
    reportId,
  );

  return (
    <div>
      <PageHeader
        title="گزارش آزمایش"
        description={`تاریخ ثبت: ${formatDate(report.created_at)}`}
        actions={
          <Link
            href="/patient/results"
            className="text-sm text-muted-foreground hover:underline"
          >
            بازگشت به نتایج
          </Link>
        }
      />

      <section className="mb-5 rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">وضعیت</p>
            <p className="mt-1 text-sm font-medium">
              {report.status === "amended"
                ? "اصلاح‌شده"
                : "نهایی"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">تاریخ نهایی‌سازی</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(report.finalized_at)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">تاریخ سفارش</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(report.lab_orders?.ordered_at)}
            </p>
          </div>
        </div>
      </section>

      {observations.length === 0 ? (
        <EmptyState
          title="نتیجه‌ای در این گزارش وجود ندارد"
          description="این گزارش نهایی شده، اما در حال حاضر نتیجه‌ای برای نمایش در آن ثبت نشده است."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">نتایج ثبت‌شده</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-right">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium">آزمایش</th>
                  <th className="px-4 py-3 text-sm font-medium">مقدار</th>
                  <th className="px-4 py-3 text-sm font-medium">واحد</th>
                  <th className="px-4 py-3 text-sm font-medium">محدوده مرجع</th>
                  <th className="px-4 py-3 text-sm font-medium">وضعیت</th>
                </tr>
              </thead>

              <tbody>
                {observations.map((observation) => {
                  const reference =
                    observation.reference_text ||
                    (observation.reference_min != null ||
                    observation.reference_max != null
                      ? `${observation.reference_min ?? "—"} تا ${observation.reference_max ?? "—"}`
                      : "—");

                  return (
                    <tr key={observation.id} className="border-t">
                      <td className="px-4 py-4 text-sm font-medium">
                        {observation.test?.name_fa ||
                          observation.test?.name ||
                          "آزمایش"}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold">
                        {getValue(observation)}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {observation.unit ||
                          observation.test?.default_unit ||
                          "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {reference}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {flagLabel(observation.flag)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm leading-6 text-amber-900">
          خارج بودن یک مقدار از محدوده مرجع به‌تنهایی به معنی تشخیص بیماری نیست. تفسیر بالینی نتایج توسط پزشک انجام می‌شود.
        </p>
      </div>
    </div>
  );
}
