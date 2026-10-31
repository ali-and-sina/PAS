"use client";

import { JalaliDateField } from "@/components/care/JalaliCalendar";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createPhysicianFollowUp,
  updatePhysicianFollowUpStatus,
} from "@/features/physician-care/actions";

const initialState = { ok: null, message: "" };

function ActionMessage({ state }) {
  if (!state?.message) return null;
  return (
    <p
      className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function PhysicianFollowUpCreateForm({ patientOptions = [] }) {
  const [state, formAction, pending] = useActionState(createPhysicianFollowUp, initialState);
  const [dueDate,setDueDate]=useState("");

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-sm">
        بیمار
        <select name="patient_id" required className="h-10 rounded-md border bg-background px-3">
          <option value="">انتخاب بیمار</option>
          {patientOptions.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        عنوان
        <input name="title" required maxLength={200} className="h-10 rounded-md border bg-background px-3" placeholder="مثلاً پیگیری نتیجه آزمایش" />
      </label>
      <JalaliDateField label="تاریخ سررسید" name="due_date" value={dueDate} onChange={setDueDate} required disabled={pending} />
      <label className="grid gap-1 text-sm">
        توضیحات (اختیاری)
        <input name="description" maxLength={3000} className="h-10 rounded-md border bg-background px-3" placeholder="توضیح کوتاه پیگیری" />
      </label>
      <div className="space-y-2 md:col-span-2">
        <Button type="submit" disabled={pending || !dueDate}>{pending ? "در حال ثبت..." : "ثبت پیگیری"}</Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function PhysicianFollowUpStatusForm({ id, status, label, variant = "outline" }) {
  const [state, formAction, pending] = useActionState(updatePhysicianFollowUpStatus, initialState);

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={status} />
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? "در حال ثبت..." : label}
        </Button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}
