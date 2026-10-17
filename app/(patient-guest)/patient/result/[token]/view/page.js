import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";

import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuestResultByToken } from "@/features/patient/guest";
import { formatReferenceRange } from "@/features/lab-results/reference-format";
import { getTestDisplayName } from "@/lib/medical/test-name";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

function getNestedTest(observation) {
  return Array.isArray(observation?.test_definitions)
    ? observation.test_definitions[0]
    : observation?.test_definitions;
}

function formatValue(observation) {
  if (observation.value_numeric !== null && observation.value_numeric !== undefined) return observation.value_numeric;
  if (observation.value_boolean !== null && observation.value_boolean !== undefined) return observation.value_boolean ? "مثبت" : "منفی";
  return observation.value_text ?? "—";
}



export default async function GuestResultViewPage({ params }) {
  const { token } = await params;
  const access = await getGuestResultByToken(token);

  if (!access?.report?.id) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl rounded-3xl border bg-card p-6 text-center sm:p-8">
          <LockKeyhole className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">دسترسی به نتیجه ممکن نیست</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">این لینک معتبر، فعال یا منقضی‌نشده نیست.</p>
        </div>
      </main>
    );
  }

  const observations = access.observations ?? [];

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Link
          href={`/patient/result/${token}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight aria-hidden="true" />
          بازگشت
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">پاس</p>
            <h1 className="mt-1 text-2xl font-semibold">نتیجه آزمایش</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              نهایی‌شده در {formatDate(access.report.finalized_at ?? access.report.created_at)}
            </p>
          </div>
          <StatusBadge
            label={access.report.status === "amended" ? "اصلاح‌شده" : "نهایی"}
            variant={access.report.status === "amended" ? "amended" : "normal"}
            icon={CheckCircle2}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" aria-hidden="true" />
              نتایج ثبت‌شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            {observations.length === 0 ? (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">موردی برای نمایش ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {observations.map((observation) => {
                  const test = getNestedTest(observation);
                  return (
                    <div key={observation.id} className="rounded-2xl border p-4 sm:p-5">
                      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.7fr_1fr] lg:items-center">
                        <div>
                          <p className="font-medium">{getTestDisplayName(test)}</p>
                          {test?.internal_code && <p className="mt-1 text-xs text-muted-foreground">{test.internal_code}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">نتیجه</p>
                          <p className="mt-1 text-lg font-semibold tabular-nums">{formatValue(observation)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">واحد</p>
                          <p className="mt-1 text-sm">{observation.unit || test?.default_unit || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">محدوده مرجع</p>
                          <p className="mt-1 text-sm">{formatReferenceRange(observation) || "محدوده مرجع ثبت نشده"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-7 text-amber-900">
            نمایش این نتیجه صرفاً برای اطلاع از داده ثبت‌شده است. خارج بودن یک مقدار از محدوده مرجع به‌تنهایی به معنی تشخیص بیماری نیست.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">این فقط یکی از نتایج سلامت شماست.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                با ورود به حساب پاس می‌توانید سابقه نتایج، روندها و پیگیری‌های خود را یکجا ببینید.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/login?next=${encodeURIComponent(`/patient/result/${token}/view`)}`}>
                ورود به پرونده سلامت من
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
