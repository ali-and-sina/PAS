"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE = { ok: false, code: "", message: "" };

function SubmitButton({ label }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "در حال ثبت..." : label}
    </Button>
  );
}

function Field({ label, name, type = "text", required = true, placeholder }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={type === "tel" ? "tel" : "off"}
      />
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function DoctorForm({ action }) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      toast.success("پزشک با موفقیت ایجاد شد.");
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="نام و نام خانوادگی" name="full_name" placeholder="مثلاً دکتر علی رضایی" />
        <Field label="شماره موبایل" name="phone" type="tel" placeholder="0912..." />
        <Field label="شماره نظام پزشکی" name="medical_license_number" placeholder="شماره مجوز" />
        <Field label="تخصص" name="specialty" required={false} placeholder="مثلاً داخلی" />
      </div>
      <FormError message={state?.message} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>انصراف</Button>
        <SubmitButton label="ایجاد پزشک" />
      </div>
    </form>
  );
}

export function LaboratoryForm({ action }) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      toast.success("آزمایشگاه با موفقیت ایجاد شد.");
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="نام مسئول" name="full_name" placeholder="نام مسئول حساب" />
        <Field label="شماره موبایل" name="phone" type="tel" placeholder="0912..." />
        <Field label="نام آزمایشگاه" name="organization_name" placeholder="نام مرکز آزمایشگاهی" />
        <Field label="شماره مجوز" name="license_number" placeholder="شماره مجوز آزمایشگاه" />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">
        برای این حساب یک سازمان از نوع آزمایشگاه نیز ساخته و به پروفایل آن متصل می‌شود.
      </div>
      <FormError message={state?.message} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>انصراف</Button>
        <SubmitButton label="ایجاد آزمایشگاه" />
      </div>
    </form>
  );
}

export function FormIntro({ type }) {
  const isDoctor = type === "doctor";
  const Icon = isDoctor ? Stethoscope : Building2;

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{isDoctor ? "ساخت حساب پزشک" : "ساخت حساب آزمایشگاه"}</p>
        <p className="text-sm leading-6 text-muted-foreground">
          اطلاعات پایه را ثبت کنید. جزئیات تکمیلی بعداً قابل توسعه است.
        </p>
      </div>
    </div>
  );
}

export function SecondaryNote({ children }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
      <span aria-hidden="true">•</span>
      <p className="leading-7">{children}</p>
    </div>
  );
}
