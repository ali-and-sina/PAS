"use client";

import { useState, useActionState } from "react";
import { createPrescription } from "@/features/prescriptions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };
const emptyItem = { medication_name: "", dosage: "", frequency: "", duration: "", instructions: "" };

export default function PrescriptionForm({ patientId }) {
  const [items, setItems] = useState([emptyItem]);
  const [state, formAction, pending] = useActionState(createPrescription, initialState);

  const updateItem = (index, key, value) => setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const addItem = () => setItems((current) => current.length < 20 ? [...current, { ...emptyItem }] : current);
  const removeItem = (index) => setItems((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));

  return (
    <form action={formAction} className="space-y-5 rounded-xl border bg-card p-5">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="items_json" value={JSON.stringify(items)} readOnly />
      <div className="space-y-4">
        {items.map((item, index) => <div key={index} className="space-y-4 rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">داروی {index + 1}</p>{items.length > 1 ? <button type="button" onClick={() => removeItem(index)} className="text-xs text-destructive hover:underline">حذف</button> : null}</div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor={`medication-${index}`}>نام دارو</Label><Input id={`medication-${index}`} value={item.medication_name} onChange={(e) => updateItem(index, "medication_name", e.target.value)} required /></div><div className="space-y-2"><Label htmlFor={`dosage-${index}`}>دوز</Label><Input id={`dosage-${index}`} value={item.dosage} onChange={(e) => updateItem(index, "dosage", e.target.value)} required placeholder="مثلاً ۵۰۰ میلی‌گرم" /></div><div className="space-y-2"><Label htmlFor={`frequency-${index}`}>نحوه مصرف</Label><Input id={`frequency-${index}`} value={item.frequency} onChange={(e) => updateItem(index, "frequency", e.target.value)} required placeholder="مثلاً روزی دو بار" /></div><div className="space-y-2"><Label htmlFor={`duration-${index}`}>مدت</Label><Input id={`duration-${index}`} value={item.duration} onChange={(e) => updateItem(index, "duration", e.target.value)} placeholder="مثلاً ۷ روز" /></div></div><div className="space-y-2"><Label htmlFor={`instructions-${index}`}>دستور مصرف</Label><Textarea id={`instructions-${index}`} value={item.instructions} onChange={(e) => updateItem(index, "instructions", e.target.value)} rows={2} /></div></div>)}
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addItem} disabled={items.length >= 20}>افزودن دارو</Button><Button type="submit" disabled={pending} loading={pending}>{pending ? "در حال ثبت..." : "ثبت نسخه"}</Button></div>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="alert">{state.message}</p> : null}
    </form>
  );
}
