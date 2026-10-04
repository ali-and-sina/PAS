"use client";

import { useActionState } from "react";
import { createLabOrder } from "@/features/lab-orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export default function LabOrderForm({ patients, laboratories, testPanels, defaultPatientId = "" }) {
  const [state, formAction, pending] = useActionState(createLabOrder, initialState);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border bg-card p-6">
      <div className="space-y-2"><Label htmlFor="patient_id">بیمار</Label><select id="patient_id" name="patient_id" defaultValue={defaultPatientId} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">انتخاب بیمار</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name || "بدون نام"}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="laboratory_id">آزمایشگاه</Label><select id="laboratory_id" name="laboratory_id" required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">انتخاب آزمایشگاه</option>{laboratories.map((lab) => <option key={lab.id} value={lab.id}>{lab.full_name} — {lab.license_number}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="test_panel_id">نوع آزمایش</Label><select id="test_panel_id" name="test_panel_id" required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">انتخاب پنل</option>{testPanels.map((panel) => <option key={panel.id} value={panel.id}>{panel.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="clinical_note">یادداشت بالینی</Label><Textarea id="clinical_note" name="clinical_note" rows={4} placeholder="یادداشت اختیاری برای آزمایشگاه" /></div>
      {state.message ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "در حال ثبت..." : "ثبت سفارش آزمایش"}</Button>
    </form>
  );
}
