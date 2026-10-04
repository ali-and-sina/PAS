"use client";

import { useActionState } from "react";

import { correctLabResult } from "@/features/lab-results/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = {
  ok: false,
  message: "",
};

function getCurrentValue(observation) {
  if (observation.value_numeric != null) {
    return String(observation.value_numeric);
  }

  if (observation.value_text != null) {
    return observation.value_text;
  }

  if (observation.value_boolean != null) {
    return String(observation.value_boolean);
  }

  return "";
}

export default function CorrectionForm({ reportId, observation }) {
  const [state, formAction, pending] = useActionState(
    correctLabResult,
    initialState,
  );

  const current = getCurrentValue(observation);

  const label = observation.test?.name_fa || observation.test?.name || "آزمایش";

  const isBoolean = observation.test?.value_type === "boolean";

  const isNumeric = observation.test?.value_type === "numeric";

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5">
      <input type="hidden" name="report_id" value={reportId} />

      <input type="hidden" name="observation_id" value={observation.id} />

      <div className="space-y-2">
        <Label htmlFor={`correction-${observation.id}`}>{label}</Label>

        {isBoolean ? (
          <select
            id={`correction-${observation.id}`}
            name="value"
            defaultValue={current}
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">انتخاب نتیجه</option>

            <option value="true">مثبت / بله</option>

            <option value="false">منفی / خیر</option>
          </select>
        ) : (
          <Input
            id={`correction-${observation.id}`}
            name="value"
            type={isNumeric ? "number" : "text"}
            inputMode={isNumeric ? "decimal" : "text"}
            step={isNumeric ? "any" : undefined}
            defaultValue={current}
            required
          />
        )}
      </div>

      {state.message ? (
        <p
          className={`mt-3 text-sm ${
            state.ok ? "text-status-normal" : "text-destructive"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}

      <Button className="mt-4" type="submit" disabled={pending}>
        {pending ? "در حال اصلاح..." : "ثبت اصلاح"}
      </Button>
    </form>
  );
}
