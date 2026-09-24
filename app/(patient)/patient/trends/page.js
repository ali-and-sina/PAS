import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = {
  title: "روند سلامت",
};

export default async function TrendsPage({ searchParams }) {
  const params = await searchParams;
  const selectedTestId = params?.test ?? null;

  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  /*
    اینجا باید دو Query زده شود:

    1) لیست تست‌های قابل نمایش در روند:
       getPatientTrendTests({ patientId: user.id })
       منبع: features/trends/queries.js
       خروجی:
       [{ test_definition_id, test_name, test_name_fa, unit, data_points_count }]
       فیلتر: فقط تست‌هایی که حداقل ۲ داده final دارند

    2) داده روند برای تست انتخاب‌شده:
       getPatientTrendData({ patientId: user.id, testDefinitionId: selectedTestId })
       منبع: features/trends/queries.js
       منبع داده: trend_analyses JOIN observations
       خروجی:
       [{
         observed_at, observed_at_display,
         value_numeric, unit,
         reference_min, reference_max,
         flag, direction, percent_change
       }]
       فیلتر: status = 'final'
       مرتب‌سازی: observed_at ASC
  */
  const availableTests = [];
  const trendPoints = [];

  const hasAnyTest = availableTests.length > 0;
  const hasSelectedData = trendPoints.length >= 2;

  return (
    <div className="space-y-6">
      <PageHeader
        title="روند سلامت"
        description="تغییرات مقادیر آزمایش‌های شما در طول زمان."
      />

      {!hasAnyTest ? (
        <EmptyState
          title="داده کافی برای نمایش روند وجود ندارد"
          description="برای مشاهده روند، حداقل به دو نتیجه ثبت‌شده از یک آزمایش نیاز است."
          icon={TrendingUp}
        />
      ) : (
        <>
          {/* ─── Test Selector ──────────────────────────── */}
          <section className="space-y-3">
            {/*
              کامپوننت مورد انتظار: <TrendSelector
                tests={availableTests}
                selectedId={selectedTestId}
              />
              Client Component — Dropdown از shadcn
              تغییر انتخاب → router.push(`/patient/trends?test=${id}`)
              URL state برای deep linking
            */}
          </section>

          {/* ─── Chart ──────────────────────────────────── */}
          <section className="rounded-lg border bg-card p-4 md:p-6">
            {hasSelectedData /*
                کامپوننت مورد انتظار: <TrendChart
                  testName={...}
                  unit={...}
                  points={trendPoints}
                  referenceRange={{ min, max }}
                />
                Client Component — Recharts
                محور X: تاریخ شمسی
                محور Y: مقدار
                Tooltip: تاریخ + مقدار + واحد
                خط افقی ملایم برای رنج مرجع
                بدون grid پیچیده، بدون legend اضافه
              */ ? null : (
              <EmptyState
                title="داده کافی برای این تست وجود ندارد"
                description="برای مشاهده روند، حداقل دو نتیجه ثبت‌شده از این تست لازم است."
                icon={TrendingUp}
              />
            )}
          </section>

          {/* ─── Data Table ─────────────────────────────── */}
          {hasSelectedData && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">داده‌های ثبت‌شده</h2>
            </section>
          )}
        </>
      )}
    </div>
  );
}
