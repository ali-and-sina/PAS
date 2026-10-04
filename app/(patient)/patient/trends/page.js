import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientTrendTests } from "@/features/trends/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function PatientTrendsPage() {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const tests = await getPatientTrendTests(patientId);

  return (
    <div>
      <PageHeader
        title="روند آزمایش‌ها"
        description="نتایج قابل مقایسه یک آزمایش را در طول زمان ببینید."
      />

      {tests.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="هنوز داده‌ای برای روند وجود ندارد"
          description="برای نمایش روند، حداقل نتایج نهایی برای آزمایش‌های شما باید ثبت شده باشد."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/patient/trends/${test.id}`}
              className="rounded-xl border bg-card p-5 transition hover:shadow-sm"
            >
              <h2 className="font-semibold">
                {test.display_name || test.name_fa || test.name}
              </h2>

              {test.code ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {test.code}
                </p>
              ) : null}

              <span className="mt-4 inline-block text-sm text-muted-foreground">
                مشاهده روند ←
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
