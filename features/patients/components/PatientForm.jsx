"use client";

import { useActionState } from "react";

import { addExistingPatient } from "@/features/patients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { ok: false, message: "" };

export default function PatientForm() {
  const [state, formAction, pending] = useActionState(addExistingPatient, initialState);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="national_id">کد ملی بیمار</Label>
        <Input id="national_id" name="national_id" inputMode="numeric" maxLength={10} required placeholder="۱۰ رقم" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">شماره موبایل بیمار</Label>
        <Input id="phone" name="phone" inputMode="tel" required placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" />
        <p className="text-xs text-muted-foreground">برای جلوگیری از اتصال اشتباه، هر دو مشخصه بررسی می‌شوند.</p>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="alert">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "در حال بررسی..." : "افزودن بیمار"}
      </Button>
    </form>
  );
}
