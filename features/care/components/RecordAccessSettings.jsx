"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RECORD_SCOPES } from "@/lib/care/constants";
import { useCareAction, CareFeedback } from "@/components/care/ActionControls";
import { JalaliDateField } from "@/components/care/JalaliCalendar";
import { tehranDayKey, tehranDateTimeToISO } from "@/lib/care/dates";
function DoctorAccess({ row, today }) {
  const [scopes, setScopes] = useState(row.grant?.scopes || []);
  const [expiry, setExpiry] = useState(row.grant?.expires_at ? tehranDayKey(row.grant.expires_at) : "");
  const { run, pending, feedback } = useCareAction();
  return <form className="space-y-4 rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); run("access.set", { doctor_id: row.doctor_id, scopes, expires_at: expiry ? tehranDateTimeToISO(expiry, "23:59") : null }); }}>
    <h3 className="font-semibold">{row.doctor_name}</h3><fieldset className="grid gap-2 sm:grid-cols-2"><legend className="sr-only">بخش‌های مجاز پرونده</legend>{RECORD_SCOPES.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="size-4 accent-teal-700" checked={scopes.includes(key)} disabled={pending} onChange={(e) => setScopes((old) => e.target.checked ? [...old, key] : old.filter((v) => v !== key))} />{label}</label>)}</fieldset>
    <div className="max-w-sm"><JalaliDateField value={expiry} onChange={setExpiry} today={today} min={today} label="آخرین روز دسترسی، اختیاری" disabled={pending} />{expiry && <Button type="button" variant="ghost" onClick={() => setExpiry("")} disabled={pending}>حذف محدودیت زمانی</Button>}</div>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending} loading={pending}>ذخیرهٔ مجوزها</Button><Button type="button" variant="outline" disabled={pending} onClick={() => run("access.set", { doctor_id: row.doctor_id, scopes: [], expires_at: null }, () => setScopes([]))}>قطع دسترسی به جزئیات پرونده</Button></div><CareFeedback value={feedback} />
  </form>;
}
export default function RecordAccessSettings({ rows, today }) {
  return <section className="space-y-4"><h2 className="text-lg font-semibold">مجوزهای اختصاصی هر پزشک</h2><p className="text-sm leading-7 text-muted-foreground">بخش‌های پرونده و مدت دسترسی را برای هر پزشک انتخاب کنید. مشخصات پایهٔ ارتباط بیمار و پزشک باقی می‌ماند؛ جزئیات پزشکی فقط با مجوز انتخابی نمایش داده می‌شوند.</p>{rows.length ? rows.map((row) => <DoctorAccess key={row.id} row={row} today={today} />) : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">پزشک مرتبطی برای تنظیم دسترسی وجود ندارد.</p>}</section>;
}
