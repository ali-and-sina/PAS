import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import { getSessionUser } from "@/lib/auth/server";
import { getPatientTrend } from "@/features/trends/queries";
import TrendChart from "@/features/trends/components/TrendChart";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getValue(row) {
  if (row.value_numeric != null) return row.value_numeric;
  if (row.value_text != null) return row.value_text;
  if (row.value_boolean != null) {
    return row.value_boolean ? "مثبت" : "منفی";
  }
  return "—";
}

export default async function PatientTrendDetailPage({ params }) {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const { testDefinitionId } = await params;
  const rows = await getPatientTrend(
    patientId,
    testDefinitionId,
  );

  if (!rows.length) {
    notFound();
  }

  const test = rows[0]?.test;
  const values = rows.map((row) => getValue(row));
  const numericValues = rows
    .map((row) => row.value_numeric)
    .filter((value) => value != null);

  const min = numericValues.length
    ? Math.min(...numericValues)
    : null;
  const max = numericValues.length
    ? Math.max(...numericValues)
    : null;

  return (
    <div>
      <PageHeader
        title={`روند ${test?.name_fa || test?.name || "آزمایش"}`}
        description="نتایج نهایی ثبت‌شده این آزمایش در طول زمان."
        actions={
          <Link
            href="/patient/trends"
            className="text-sm text-muted-foreground hover:underline"
          >
            بازگشت به روندها
          </Link>
        }
      />

      {numericValues.length >= 2 ? (
        <section className="rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">تعداد نتایج</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {numericValues.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">کمترین مقدار</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {min}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">بیشترین مقدار</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {max}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {numericValues.length >= 2 ? (
        <section className="mt-5 rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">نمودار تغییرات</h2>
          <TrendChart data={rows} />
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">سوابق نتیجه</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-sm font-medium">تاریخ</th>
                <th className="px-4 py-3 text-sm font-medium">نتیجه</th>
                <th className="px-4 py-3 text-sm font-medium">واحد</th>
                <th className="px-4 py-3 text-sm font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-4 text-sm">
                    {formatDate(row.observed_at)}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {getValue(row)}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {row.unit || test?.default_unit || "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {row.status === "corrected"
                      ? "اصلاح‌شده"
                      : "نهایی"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
