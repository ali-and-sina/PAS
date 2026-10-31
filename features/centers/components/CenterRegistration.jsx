"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMedicalCenter } from "@/features/centers/actions";
import { CENTER_TYPE_OPTIONS } from "@/lib/centers/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function CenterRegistration({ defaultType = "laboratory" }) {
  const [state, action, pending] = useActionState(createMedicalCenter, {ok:false});
  const router = useRouter();
  useEffect(() => { if(state.ok && state.redirectTo) router.push(state.redirectTo); }, [state,router]);
  return <form action={action} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-2 text-sm"><span>نام مرکز</span><Input name="display_name" minLength={2} maxLength={160} required disabled={pending} /></label>
      <label className="block space-y-2 text-sm"><span>نوع مرکز و پنل اختصاصی</span><select aria-label="نوع مرکز و پنل اختصاصی" name="center_type" defaultValue={defaultType} disabled={pending} className="min-h-11 w-full rounded-xl border bg-card px-3" required>{CENTER_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="block space-y-2 text-sm"><span>نام مسئول حساب</span><Input name="full_name" minLength={2} maxLength={120} required disabled={pending} /></label>
      <label className="block space-y-2 text-sm"><span>شمارهٔ مجوز مرکز</span><Input name="license_number" dir="ltr" maxLength={100} required disabled={pending} /></label>
      <label className="block space-y-2 text-sm"><span>نام کاربری، شمارهٔ همراه مسئول حساب</span><Input name="phone" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={16} required disabled={pending} /></label>
      <label className="block space-y-2 text-sm"><span>رمز عبور اولیه، حداقل ۱۲ نویسه</span><Input name="password" type="password" autoComplete="new-password" dir="ltr" minLength={12} maxLength={128} required disabled={pending} /></label>
    </div>
    <p className="rounded-xl bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">نوع مرکز، پنل و خدمات مجاز را تعیین می‌کند و از حساب مرکز قابل تغییر نیست. برای یک مرکز با مجوز و حوزهٔ متفاوت، حساب مستقل بسازید. مشخصات ورود را به مسئول تأییدشدهٔ مرکز تحویل دهید.</p>
    {state.message && <p role={state.ok ? "status" : "alert"} className={"text-sm leading-7 "+(state.ok?"text-primary":"text-destructive")}>{state.message}</p>}
    <Button type="submit" loading={pending} disabled={pending}>ساخت حساب و تخصیص پنل</Button>
  </form>;
}
