"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCareAction, CareFeedback } from "@/components/care/ActionControls";
import { CENTER_TYPES } from "@/lib/centers/config";
import { normalizeDigits } from "@/lib/utils/validation";

export function normalizePhone(value) {
  let v = normalizeDigits(String(value || "")).replace(/[\s()+-]/g, "");
  if (v.startsWith("0098")) v = v.slice(2);
  if (/^09\d{9}$/.test(v)) v = "98" + v.slice(1);
  if (/^9\d{9}$/.test(v)) v = "98" + v;
  return v;
}
export default function AccountSettings({ data }) {
  const { profile, doctor, requests, user } = data;
  const [name, setName] = useState(profile.full_name);
  const [specialty, setSpecialty] = useState(doctor?.specialty || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [nationalId, setNationalId] = useState(profile.national_id || "");
  const { run, pending, feedback } = useCareAction();
  const openRequest = requests.find((r) => ["pending", "processing"].includes(r.status));
  function requestIdentity(event) {
    event.preventDefault();
    const payload = {};
    if (normalizePhone(phone) !== normalizePhone(profile.phone)) payload.phone = normalizePhone(phone);
    if (nationalId !== (profile.national_id || "")) payload.national_id = normalizeDigits(nationalId).trim();
    run("identity.request", payload);
  }
  return <div className="mx-auto w-full max-w-4xl space-y-5 sm:space-y-6">
    <form className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); run("profile.update", { full_name: name, ...(doctor ? { specialty } : {}) }); }}>
      <h2 className="font-semibold">اطلاعات حساب</h2>
      <label className="block space-y-2 text-sm"><span>نام و نام خانوادگی</span><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={150} required disabled={pending} /></label>
      {doctor && <><label className="block space-y-2 text-sm"><span>تخصص</span><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} maxLength={150} disabled={pending} /></label><p className="text-sm text-muted-foreground">شمارهٔ نظام پزشکی: <bdi>{doctor.medical_license_number}</bdi></p></>}
      <Button type="submit" className="w-full sm:w-auto" loading={pending} disabled={pending}>ذخیرهٔ اطلاعات</Button>
      {profile.role === "patient" && <Link href="/patient/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">ویرایش مشخصات تکمیلی و تماس اضطراری</Link>}
    </form>
    <form className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" onSubmit={requestIdentity}>
      <h2 className="font-semibold">اصلاح شماره و کد ملی</h2>
      <p className="text-sm leading-7 text-muted-foreground">تغییر شماره و کد ملی پس از بررسی مالکیت و تأیید مدیر انجام می‌شود تا ورود و پروندهٔ پزشکی به یک هویت متصل بمانند.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm"><span>شمارهٔ همراه</span><Input dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(normalizeDigits(e.target.value))} maxLength={16} disabled={pending || Boolean(openRequest)} /></label>
        <label className="block space-y-2 text-sm"><span>کد ملی</span><Input dir="ltr" inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(normalizeDigits(e.target.value))} maxLength={10} disabled={pending || Boolean(openRequest)} /></label>
      </div>
      {openRequest ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">درخواست اصلاح اطلاعات شما {openRequest.status === "processing" ? "در حال همگام‌سازی" : "در انتظار بررسی مدیر"} است.</p> : <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={pending} loading={pending}>ثبت درخواست اصلاح</Button>}
      {requests.filter((r) => ["approved", "rejected"].includes(r.status)).slice(0, 3).map((r) => <p key={r.id} className="text-xs leading-6 text-muted-foreground">{r.status === "approved" ? "درخواست قبلی تأیید و اعمال شد." : "درخواست قبلی رد شد."} {r.review_note}</p>)}
    </form>
    {["laboratory", "medical_center"].includes(profile.role) && <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5"><h2 className="font-semibold">مشخصات مرکز درمانی</h2><p className="break-words text-sm">{CENTER_TYPES[user.center_type]?.label || "در انتظار تعیین نوع مرکز"} · {user.center_name || "نام مرکز ثبت نشده"}</p><p className="text-sm leading-7 text-muted-foreground">نوع مرکز و خدمات مجاز توسط مدیر پلتفرم تعیین شده است. برای اصلاح مجوز یا اطلاعات مرکز با مدیر هماهنگ کنید.</p></section>}
    <CareFeedback value={feedback} />
  </div>;
}
