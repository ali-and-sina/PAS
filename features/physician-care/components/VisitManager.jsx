"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createPhysicianVisit,
  updatePhysicianVisitStatus,
} from "@/features/physician-care/actions";

const STATUS_LABELS = {
  scheduled: "برنامه‌ریزی‌شده",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function VisitManager({ patientId, visits = [] }) {
  const [visitDate, setVisitDate] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function createVisit(event) {
    event.preventDefault();
    setMessage("");
    if (!visitDate) {
      setMessage("تاریخ و زمان ویزیت را انتخاب کنید.");
      return;
    }
    const parsed = new Date(visitDate);
    if (Number.isNaN(parsed.getTime())) {
      setMessage("تاریخ و زمان ویزیت معتبر نیست.");
      return;
    }
    startTransition(async () => {
      const result = await createPhysicianVisit({
        patient_id: patientId,
        visit_date: parsed.toISOString(),
      });
      if (!result?.ok) {
        setMessage(result?.message || "ثبت ویزیت انجام نشد.");
        return;
      }
      setVisitDate("");
      setMessage("ویزیت ثبت شد.");
    });
  }

  function changeStatus(visitId, status) {
    setMessage("");
    startTransition(async () => {
      const result = await updatePhysicianVisitStatus({ id: visitId, status });
      if (!result?.ok) {
        setMessage(result?.message || "وضعیت ویزیت تغییر نکرد.");
        return;
      }
      setMessage("وضعیت ویزیت به‌روزرسانی شد.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="size-4" aria-hidden="true" /> ویزیت‌ها
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <form onSubmit={createVisit} className="rounded-xl border border-dashed p-3">
          <label htmlFor={`visit-date-${patientId}`} className="text-sm font-medium">ثبت ویزیت جدید</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={`visit-date-${patientId}`}
              type="datetime-local"
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
              required
              className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending || !visitDate}>
              <CalendarClock className="size-4" aria-hidden="true" />
              ثبت ویزیت
            </Button>
          </div>
        </form>

        {visits.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
            هنوز ویزیتی برای این بیمار ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-3">
            {visits.slice(0, 6).map((visit) => (
              <div key={visit.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">ویزیت پزشک</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {STATUS_LABELS[visit.status] || visit.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(visit.visit_date || visit.created_at)}</p>
                {visit.status === "scheduled" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => changeStatus(visit.id, "in_progress")}>شروع ویزیت</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus(visit.id, "cancelled")}>لغو ویزیت</Button>
                  </div>
                ) : null}
                {visit.status === "in_progress" ? (
                  <div className="mt-3">
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => changeStatus(visit.id, "completed")}>
                      <CheckCircle2 className="size-4" aria-hidden="true" /> تکمیل ویزیت
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
