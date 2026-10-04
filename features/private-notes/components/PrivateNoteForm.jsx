"use client";

import { useActionState } from "react";
import { createPrivateNote } from "@/features/private-notes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export default function PrivateNoteForm({ patientId, reportId = "" }) {
  const [state, formAction, pending] = useActionState(createPrivateNote, initialState);
  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="diagnostic_report_id" value={reportId} />
      <div className="space-y-2"><Label htmlFor={`private-note-${patientId}-${reportId || "general"}`}>یادداشت خصوصی پزشک</Label><Textarea id={`private-note-${patientId}-${reportId || "general"}`} name="content" rows={4} required maxLength={5000} placeholder="این متن فقط برای شما قابل مشاهده است." /></div>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="alert">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "در حال ثبت..." : "ثبت یادداشت خصوصی"}</Button>
    </form>
  );
}
