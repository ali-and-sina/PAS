"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { LineChart, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TrendChart from "@/features/trends/components/TrendChart";
import { getPatientTestTrendForDialog } from "@/features/patient/actions";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function groupByUnit(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.unit || "بدون واحد";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      id: row.id,
      date: formatDate(row.date),
      sortDate: new Date(row.date).getTime(),
      value: row.value,
    });
  }

  return [...groups.entries()].map(([unit, points]) => ({
    unit,
    points: points.sort((a, b) => a.sortDate - b.sortDate),
  }));
}

export default function PatientLabTrendDialog({ testDefinitionId, testName }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const groups = useMemo(() => groupByUnit(rows), [rows]);

  const loadHistory = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError("");

    try {
      const result = await getPatientTestTrendForDialog(testDefinitionId);
      if (requestId !== requestIdRef.current) return;
      if (!result?.ok) throw new Error("Trend history unavailable");

      setRows(Array.isArray(result.rows) ? result.rows : []);
      setStatus("success");
    } catch {
      if (requestId !== requestIdRef.current) return;
      setRows([]);
      setError("سوابق این آزمایش بارگذاری نشد. دوباره تلاش کنید.");
      setStatus("error");
    }
  }, [testDefinitionId]);

  function handleOpenChange(nextOpen) {
    setOpen(nextOpen);
    if (!nextOpen) {
      requestIdRef.current += 1;
      if (status === "loading") setStatus("idle");
      return;
    }
    if (status === "idle" || status === "error") void loadHistory();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-start font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`مشاهده نمودار تغییرات ${testName} در طول زمان`}
        >
          <span>{testName}</span>
          <LineChart className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader className="pe-8">
          <DialogTitle>روند تغییرات {testName}</DialogTitle>
          <DialogDescription>
            نتایج عددی ثبت‌شدهٔ شما در طول زمان. این نمودار فقط روند مقادیر را نشان می‌دهد و به‌تنهایی تشخیص پزشکی نیست.
          </DialogDescription>
        </DialogHeader>

        {status === "loading" ? (
          <div className="flex min-h-44 items-center justify-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
            در حال دریافت سوابق آزمایش…
          </div>
        ) : null}

        {status === "error" ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm text-muted-foreground" role="alert">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadHistory()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              تلاش دوباره
            </Button>
          </div>
        ) : null}

        {status === "success" ? (
          rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm leading-7 text-muted-foreground">
              برای این آزمایش سابقهٔ عددی دیگری ثبت نشده است.
            </div>
          ) : (
            <div className="max-h-[65dvh] space-y-4 overflow-y-auto pe-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{rows.length.toLocaleString("fa-IR")} نتیجهٔ عددی ثبت‌شده</span>
                <span>نمایش به ترتیب زمانی</span>
              </div>

              {groups.map((group) => (
                <section key={group.unit} className="space-y-3 rounded-xl border p-3 sm:p-4" aria-label={`نمودار بر اساس ${group.unit}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{groups.length > 1 ? `واحد اندازه‌گیری: ${group.unit}` : `واحد: ${group.unit}`}</h3>
                    <span className="text-xs text-muted-foreground">{group.points.length.toLocaleString("fa-IR")} نتیجه</span>
                  </div>

                  {group.points.length >= 2 ? (
                    <TrendChart data={group.points.map(({ date, value }) => ({ date, value }))} unit={group.unit === "بدون واحد" ? null : group.unit} />
                  ) : (
                    <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
                      فعلاً فقط یک نتیجه با این واحد ثبت شده است؛ برای نمایش تغییرات به نتایج بیشتری نیاز داریم.
                    </p>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.points.slice(-4).reverse().map((point) => (
                      <div key={point.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{point.date}</span>
                        <span className="font-semibold tabular-nums">{point.value.toLocaleString("fa-IR")}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
