"use client";

import { useState, useActionState } from "react";
import { createPrescription } from "@/features/prescriptions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };
const emptyItem = { medication_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity_units: "", units_per_day: "", unit_label: "عدد", as_needed: false };

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
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-2 text-sm font-semibold">مقدار و برنامهٔ مصرف برای برآورد موجودی</legend>
        <p className="text-xs leading-6 text-muted-foreground">مقدار را بر حسب واحد مصرف بنویسید؛ برای مثال ۱۰ خشابِ ۱۰ عددی یعنی ۱۰۰ عدد. بدون مقدار مصرف روزانه، پایان موجودی برآورد نمی‌شود.</p>
        {items.map((item,index) => <div key={index} className="space-y-3 border-b pb-4 last:border-0">
          <p className="text-sm font-medium">{item.medication_name || "داروی " + (index+1).toLocaleString("fa-IR")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm"><span>مقدار کل دارو</span><Input type="number" min="0.001" max="1000000" step="0.001" value={item.quantity_units} onChange={e=>updateItem(index,"quantity_units",e.target.value)} /></label>
            <label className="space-y-2 text-sm"><span>واحد مصرف</span><Input value={item.unit_label} maxLength={30} onChange={e=>updateItem(index,"unit_label",e.target.value)} placeholder="عدد یا میلی‌لیتر" /></label>
            <label className="space-y-2 text-sm"><span>مقدار مصرف در روز</span><Input type="number" min="0.001" max="1000" step="0.001" disabled={item.as_needed} value={item.units_per_day} onChange={e=>updateItem(index,"units_per_day",e.target.value)} /></label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.as_needed} onChange={e=>updateItem(index,"as_needed",e.target.checked)} />مصرف در صورت نیاز؛ بدون برآورد زمان پایان</label>
        </div>)}
      </fieldset>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addItem} disabled={items.length >= 20}>افزودن دارو</Button><Button type="submit" disabled={pending} loading={pending}>{pending ? "در حال ثبت..." : "ثبت نسخه"}</Button></div>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="alert">{state.message}</p> : null}
    </form>
  );
}
