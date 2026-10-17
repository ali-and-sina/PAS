"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Save, Send } from "lucide-react";

import { saveLabResults } from "@/features/lab-results/actions";
import ResultEntryRow from "./ResultEntryRow";
import ResultImportPanel from "./ResultImportPanel";
import PDFUploadField from "./PDFUploadField";
import { Button } from "@/components/ui/button";

const initialState = { ok: false, message: "" };

export default function ResultEntryForm({ orderId, reportId = null, tests = [], defaultValues = {} }) {
  const [state, formAction, pending] = useActionState(saveLabResults, initialState);
  const [values, setValues] = useState(defaultValues);

  function handleValueChange(testId, value) {
    setValues((current) => ({ ...current, [testId]: value }));
  }

  function handleImport(importedValues) {
    setValues((current) => ({ ...current, ...importedValues }));
  }

  const requiredCount = tests.filter((test) => test.is_required).length;
  const completedRequiredCount = tests.filter(
    (test) => test.is_required && String(values[test.id] ?? "").trim() !== "",
  ).length;

  return (
    <form action={formAction} className="space-y-5" encType="multipart/form-data">
      <input type="hidden" name="order_id" value={orderId} />
      {reportId ? <input type="hidden" name="report_id" value={reportId} /> : null}

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">وضعیت ورود نتیجه</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {completedRequiredCount} از {requiredCount} آزمایش الزامی تکمیل شده است.
            </p>
          </div>
          <div className="text-xs font-medium text-muted-foreground">می‌توانید نتایج را در هر مرحله به‌صورت پیش‌نویس ذخیره کنید.</div>
        </div>
      </div>

      <ResultImportPanel tests={tests} onImport={handleImport} />

      <div className="space-y-3">
        {tests.map((test) => (
          <ResultEntryRow
            key={test.id}
            test={test}
            value={values[test.id] ?? ""}
            onChange={handleValueChange}
          />
        ))}
      </div>

      <PDFUploadField name="pdf" />

      {state.message ? (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            state.ok
              ? "border-status-normal-border bg-status-normal-bg text-status-normal"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="sticky bottom-3 z-10 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" name="finalize" value="false" variant="outline" disabled={pending}>
            <Save className="size-4" aria-hidden="true" />
            {pending ? "در حال ذخیره..." : "ذخیره پیش‌نویس نتیجه"}
          </Button>
          <Button
            type="submit"
            name="finalize"
            value="true"
            disabled={pending || (requiredCount > 0 && completedRequiredCount !== requiredCount)}
          >
            <Send className="size-4" aria-hidden="true" />
            {pending ? "در حال پردازش..." : "ذخیره و نهایی‌سازی"}
          </Button>
        </div>
      </div>
    </form>
  );
}
