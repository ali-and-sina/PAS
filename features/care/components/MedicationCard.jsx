"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/care/JalaliCalendar";
import { useCareAction, CareFeedback } from "@/components/care/ActionControls";
import { medicationCoverage, prescriptionCoverage, MEDICATION_COLORS } from "@/lib/care/medication";
import { faNumber, persianDateLabel, tehranDayKey, tehranDateTimeToISO } from "@/lib/care/dates";

function ReceiptForm({ item, today, issuedAt }) {
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const retryId = useRef(null);
  const { run, pending, feedback } = useCareAction();
  return <details className="mt-3 rounded-xl border bg-card p-3"><summary className="min-h-8 cursor-pointer text-sm font-medium">ثبت دریافت این دارو از داروخانه</summary><form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); retryId.current ||= crypto.randomUUID(); run("medication.received", { id: retryId.current, item_id: item.id, quantity_units: Number(quantity), received_at: tehranDateTimeToISO(date) }, () => { retryId.current = null; setQuantity(""); }); }}>
    <label className="block space-y-2 text-sm"><span>تعداد واقعی دریافتی، بر حسب {item.unit_label || "عدد"}</span><Input type="number" inputMode="decimal" min="0.001" max="1000000" step="0.001" value={quantity} onChange={(e) => { setQuantity(e.target.value); retryId.current = null; }} required disabled={pending} /></label>
    <JalaliDateField value={date} onChange={(v) => { setDate(v); retryId.current = null; }} label="تاریخ دریافت" today={today} max={today} min={tehranDayKey(issuedAt)} disabled={pending} required />
    <p className="text-xs leading-6 text-muted-foreground">این دریافت با عنوان «اظهار بیمار» ثبت می‌شود. هر دریافت واقعی را یک‌بار ثبت کنید.</p><Button type="submit" disabled={pending || !date} loading={pending}>ثبت دریافت دارو</Button><CareFeedback value={feedback} />
  </form></details>;
}
export default function MedicationCard({ prescription, patient = false, now, today }) {
  const items = prescription.items || prescription.prescription_items || [];
  const receipts = prescription.receipts || [];
  const coverage = prescriptionCoverage(prescription, items, receipts, Date.parse(now));
  return <article className="space-y-4 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{patient ? prescription.doctor_profiles?.full_name || "نسخهٔ پزشک" : prescription.patient_name || "نسخهٔ بیمار"}</h2><p className="mt-1 text-xs text-muted-foreground">{persianDateLabel(tehranDayKey(prescription.issued_at))}</p></div><span className={"rounded-full border px-3 py-1 text-xs font-semibold " + MEDICATION_COLORS[coverage.status]}>{coverage.label}</span></div>
    <ul className="divide-y">{items.map((item) => {
      const state = medicationCoverage(item, receipts, Date.parse(now));
      const sources=[...new Set(receipts.filter(r=>r.prescription_item_id===item.id).map(r=>({patient:"اظهار بیمار",admin:"ثبت تحویل توسط مدیر",provider:"سرویس متصل"})[r.source]).filter(Boolean))];
      return <li key={item.id} className="space-y-3 py-4 first:pt-0"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{item.medication_name}</h3><span className={"rounded-full border px-2 py-1 text-xs " + MEDICATION_COLORS[prescription.status === "active" ? state.status : "inactive"]}>{prescription.status === "active" ? state.label : "غیرفعال"}</span></div><p className="text-sm leading-7 text-muted-foreground">{item.dosage} · {item.frequency}{item.duration ? " · " + item.duration : ""}</p>{item.instructions && <p className="text-sm leading-7">{item.instructions}</p>}<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.quantity_units && <span>مقدار تجویزشده: {faNumber(item.quantity_units)} {item.unit_label}</span>}{state.received > 0 && <span>مقدار دریافتی: {faNumber(state.received)} {item.unit_label}</span>}{state.endAt && <span>پایان برآوردی موجودی: {persianDateLabel(tehranDayKey(state.endAt))}</span>}</div>{sources.length>0 && <p className="text-xs leading-6 text-muted-foreground">منبع اطلاعات دریافت: {sources.join("، ")}</p>}{patient && prescription.status === "active" && <ReceiptForm item={item} today={today} issuedAt={prescription.issued_at} />}</li>;
    })}</ul>
    <p className="text-xs leading-6 text-muted-foreground">وضعیت موجودی از مقدار دریافتی و برنامهٔ مصرف محاسبه می‌شود. پایان برآوردی، دستور قطع دارو نیست؛ برای داروی مصرفِ در صورت نیاز یا برنامهٔ نامشخص، زمان پایان محاسبه نمی‌شود.</p>
  </article>;
}
