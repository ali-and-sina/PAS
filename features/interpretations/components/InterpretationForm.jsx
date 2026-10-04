"use client";

import { useActionState } from "react";
import { createInterpretation } from "@/features/interpretations/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export default function InterpretationForm({ reportId }) {
  const [state, formAction, pending] = useActionState(createInterpretation, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="diagnostic_report_id" value={reportId} />
      <div className="space-y-2">
        <Label htmlFor={`content-${reportId}`}>تفسیر پزشک</Label>
        <Textarea id={`content-${reportId}`} name="content" rows={5} required maxLength={5000} placeholder="تفسیر بالینی خود را وارد کنید..." />
      </div>
      <input type="hidden" name="is_visible_to_patient" value="true" />
      {state.message ? <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="alert">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "در حال ثبت..." : "ثبت تفسیر"}</Button>
    </form>
  );
}
