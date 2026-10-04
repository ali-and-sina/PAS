"use client";

import { useState } from "react";
import { useActionState } from "react";

import { saveLabResults } from "@/features/lab-results/actions";
import ResultEntryRow from "./ResultEntryRow";
import ResultImportPanel from "./ResultImportPanel";
import { Button } from "@/components/ui/button";

const initialState = {
  ok: false,
  message: "",
};

export default function ResultEntryForm({
  orderId,
  reportId = null,
  tests,
  defaultValues = {},
}) {
  const [state, formAction, pending] = useActionState(
    saveLabResults,
    initialState,
  );

  const [values, setValues] = useState(defaultValues);

  function handleValueChange(testId, value) {
    setValues((current) => ({
      ...current,
      [testId]: value,
    }));
  }

  function handleImport(importedValues) {
    setValues((current) => ({
      ...current,
      ...importedValues,
    }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input
        type="hidden"
        name="order_id"
        value={orderId}
      />

      {reportId ? (
        <input
          type="hidden"
          name="report_id"
          value={reportId}
        />
      ) : null}

      <ResultImportPanel
        tests={tests}
        onImport={handleImport}
      />

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

      {state.message ? (
        <p
          className={
            state.ok
              ? "text-sm text-status-normal"
              : "text-sm text-destructive"
          }
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="finalize"
          value="false"
          disabled={pending}
        >
          {pending
            ? "در حال ذخیره..."
            : "ذخیره پیش‌نویس"}
        </Button>

        <Button
          type="submit"
          name="finalize"
          value="true"
          variant="default"
          disabled={pending}
        >
          {pending
            ? "در حال پردازش..."
            : "ذخیره و نهایی‌سازی"}
        </Button>
      </div>
    </form>
  );
}
