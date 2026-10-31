"use client";

import { JalaliDateField } from "@/components/care/JalaliCalendar";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOwnProfile } from "@/features/profile/actions";

function inputValue(value) {
  return value == null ? "" : String(value);
}

export default function PatientProfileForm({ initialProfile, initialPatientProfile }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    full_name: inputValue(initialProfile?.full_name),
    date_of_birth: inputValue(initialPatientProfile?.date_of_birth),
    sex: inputValue(initialPatientProfile?.sex),
    blood_type: inputValue(initialPatientProfile?.blood_type),
    emergency_contact_name: inputValue(initialPatientProfile?.emergency_contact_name),
    emergency_contact_phone: inputValue(initialPatientProfile?.emergency_contact_phone),
  });

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const payload = {
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        sex: form.sex,
        blood_type: form.blood_type || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      };
      const result = await updateOwnProfile(payload);
      if (!result?.ok) {
        setMessage(result?.code === "INVALID_INPUT"
          ? "اطلاعات واردشده معتبر نیست؛ نام، تاریخ تولد، جنسیت و شماره تماس اضطراری را بررسی کنید."
          : "ذخیره مشخصات انجام نشد. دوباره تلاش کنید.");
        return;
      }
      setMessage("مشخصات با موفقیت ذخیره شد.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>مشخصات بیمار</CardTitle>
        <CardDescription>شناسه و شماره تلفن حساب از این فرم قابل تغییر نیستند.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            نام و نام خانوادگی
            <input name="full_name" required maxLength={150} value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} className="h-10 rounded-md border bg-background px-3" />
          </label>
          <JalaliDateField name="date_of_birth" label="تاریخ تولد" birthDate required value={form.date_of_birth} onChange={value=>setField("date_of_birth",value)} disabled={pending} />
          <label className="grid gap-1.5 text-sm">
            جنسیت
            <select name="sex" required value={form.sex} onChange={(e) => setField("sex", e.target.value)} className="h-10 rounded-md border bg-background px-3">
              <option value="">انتخاب کنید</option>
              <option value="female">زن</option>
              <option value="male">مرد</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            گروه خونی (اختیاری)
            <input name="blood_type" maxLength={8} value={form.blood_type} onChange={(e) => setField("blood_type", e.target.value)} className="h-10 rounded-md border bg-background px-3" />
          </label>
          <label className="grid gap-1.5 text-sm">
            نام تماس اضطراری (اختیاری)
            <input name="emergency_contact_name" maxLength={150} value={form.emergency_contact_name} onChange={(e) => setField("emergency_contact_name", e.target.value)} className="h-10 rounded-md border bg-background px-3" />
          </label>
          <label className="grid gap-1.5 text-sm">
            تلفن تماس اضطراری (اختیاری)
            <input name="emergency_contact_phone" type="tel" maxLength={30} value={form.emergency_contact_phone} onChange={(e) => setField("emergency_contact_phone", e.target.value)} placeholder="+994..." className="h-10 rounded-md border bg-background px-3" />
          </label>
          <div className="space-y-2 md:col-span-2">
            <Button type="submit" disabled={pending} loading={pending} aria-busy={pending}>{pending ? "در حال ذخیره..." : "ذخیره مشخصات"}</Button>
            {message ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
