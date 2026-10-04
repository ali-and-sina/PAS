"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FormError from "@/components/shared/FormError";
import { cn } from "@/lib/utils";
import { getFieldErrors, normalizeDigits } from "@/lib/utils/validation";
import { createDoctor } from "@/features/admin/actions";
import { doctorSchema } from "@/features/admin/schemas";

const GENERIC_ERROR = "ثبت پزشک با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";

const ERROR_MESSAGES = {
  INVALID_INPUT: "اطلاعات واردشده معتبر نیست.",
  DUPLICATE_LICENSE: "این شماره نظام پزشکی قبلاً ثبت شده است.",
  DUPLICATE_PHONE: "این شماره موبایل قبلاً ثبت شده است.",
  UNAUTHORIZED: "شما اجازه انجام این کار را ندارید.",
};

function Field({ id, label, error, hint, className, ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-11", className, error && "border-destructive")}
        {...inputProps}
      />
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default function DoctorForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    full_name: "",
    phone: "",
    medical_license_number: "",
    specialty: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: normalizeDigits(value) }));
    setFieldErrors((prev) =>
      prev[field] ? { ...prev, [field]: undefined } : prev,
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const parsed = doctorSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const result = await createDoctor(parsed.data);

      if (result?.ok) {
        toast.success("پزشک با موفقیت ثبت شد.");
        router.push(`/admin/doctors/${result.doctorId}`);
        router.refresh();
        return;
      }

      setFormError(ERROR_MESSAGES[result?.code] ?? GENERIC_ERROR);
    } catch {
      setFormError(GENERIC_ERROR);
    }

    setPending(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <FormError>{formError}</FormError>

      <Field
        id="full_name"
        label="نام و نام خانوادگی"
        dir="auto"
        autoComplete="name"
        value={values.full_name}
        onChange={(e) => handleChange("full_name", e.target.value)}
        error={fieldErrors.full_name}
      />

      <Field
        id="phone"
        label="شماره موبایل"
        dir="ltr"
        className="tabular-nums"
        inputMode="tel"
        autoComplete="tel"
        placeholder="09123456789"
        value={values.phone}
        onChange={(e) => handleChange("phone", e.target.value)}
        error={fieldErrors.phone}
      />

      <Field
        id="medical_license_number"
        label="شماره نظام پزشکی"
        dir="ltr"
        className="tabular-nums"
        inputMode="numeric"
        value={values.medical_license_number}
        onChange={(e) => handleChange("medical_license_number", e.target.value)}
        error={fieldErrors.medical_license_number}
      />

      <Field
        id="specialty"
        label="تخصص"
        dir="auto"
        value={values.specialty}
        onChange={(e) => handleChange("specialty", e.target.value)}
        error={fieldErrors.specialty}
      />

      <Button
        type="submit"
        className="h-11 w-full sm:w-auto"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "در حال ثبت..." : "افزودن پزشک"}
      </Button>
    </form>
  );
}
