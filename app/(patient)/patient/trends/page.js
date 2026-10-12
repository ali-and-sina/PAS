import Link from "next/link";
import { LineChart, TrendingUp } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientTrendTests } from "@/features/patient/queries";
import { getTestDisplayName } from "@/lib/medical/test-name";

export const dynamic = "force-dynamic";

export default async function PatientTrendsPage() {
  const tests = await getPatientTrendTests();

  return (
    <div className="space-y-6">
      <PageHeader
        title="روند نتایج"
        description="تغییرات واقعی نتایج آزمایش در طول زمان؛ بدون تفسیر تشخیصی."
      />

      {tests.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={TrendingUp}
              title="داده‌ای برای مقایسه وجود ندارد"
              description="با ثبت نتایج بیشتر، آزمایش‌های قابل مقایسه اینجا ظاهر می‌شوند."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/patient/trends/${test.id}`}
              className="group rounded-2xl border bg-card p-5 transition hover:border-primary/30 hover:bg-accent/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">آزمایش</p>
                  <h2 className="mt-1 font-semibold">
                    {getTestDisplayName(test)}
                  </h2>
                </div>
                <LineChart className="size-5 text-primary" aria-hidden="true" />
              </div>

              <p className="mt-4 text-sm font-medium text-primary">مشاهده روند ←</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
