"use client";
import { useState } from "react";
import { loginMedicalCenter } from "@/features/centers/actions";
import { normalizeDigits } from "@/lib/utils/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function CenterPasswordForm({ onBack }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await loginMedicalCenter({ phone, password });
      if (result.ok) { window.location.replace(result.redirectTo); return; }
      setError(result.message);
    } catch { setError("ورود انجام نشد؛ دوباره تلاش کنید."); }
    finally { setPending(false); }
  }
  return <form className="space-y-4" onSubmit={submit} aria-label="ورود مرکز درمانی">
    <label className="block space-y-2 text-sm"><span>نام کاربری، شمارهٔ همراه ثبت‌شده</span><Input autoComplete="username" inputMode="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(normalizeDigits(e.target.value))} disabled={pending} maxLength={16} /></label>
    <label className="block space-y-2 text-sm"><span>رمز عبور مرکز</span><Input autoComplete="current-password" type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending} maxLength={128} /></label>
    <p className="text-sm leading-7 text-muted-foreground">حساب و نوع مرکز را مدیر پلتفرم تعیین می‌کند. پس از ورود، به پنل اختصاصی مرکز خود منتقل می‌شوید.</p>
    {error && <p role="alert" className="text-sm leading-7 text-destructive">{error}</p>}
    <Button type="submit" className="w-full" loading={pending} disabled={pending}>ورود به پنل مرکز</Button>
    {onBack && <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>بازگشت به انتخاب نقش</Button>}
  </form>;
}
