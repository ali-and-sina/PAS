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
import { createLaboratory } from "@/features/admin/actions";
import { laboratorySchema } from "@/features/admin/schemas";

const GENERIC_ERROR = "ثبت آزمایشگاه با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";

const ERROR_MESSAGES = {
  INVALID_INPUT: "اطلاعات واردشده معتبر نیست.",
  DUPLICATE_LICENSE: "این شماره مجوز قبلاً ثبت شده است.",
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

export default function LaboratoryForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    organization_name: "",
    phone: "",
    license_number: "",
    organization_type: "",
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

    const parsed = laboratorySchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const result = await createLaboratory(parsed.data);

      if (result?.ok) {
        toast.success("آزمایشگاه با موفقیت ثبت شد.");
        router.push("/admin/laboratories");
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
        id="organization_name"
        label="نام آزمایشگاه / سازمان"
        dir="auto"
        value={values.organization_name}
        onChange={(e) => handleChange("organization_name", e.target.value)}
        error={fieldErrors.organization_name}
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
        id="license_number"
        label="شماره مجوز"
        dir="ltr"
        className="tabular-nums"
        value={values.license_number}
        onChange={(e) => handleChange("license_number", e.target.value)}
        error={fieldErrors.license_number}
      />

      <Field
        id="organization_type"
        label="نوع سازمان"
        dir="auto"
        placeholder="مثلاً آزمایشگاه تشخیص طبی"
        value={values.organization_type}
        onChange={(e) => handleChange("organization_type", e.target.value)}
        error={fieldErrors.organization_type}
      />

      <Button
        type="submit"
        className="h-11 w-full sm:w-auto"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "در حال ثبت..." : "افزودن آزمایشگاه"}
      </Button>
    </form>
  );
}
