"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FormError from "@/components/shared/FormError";
import FormField from "@/components/shared/FormField";
import FormErrorSummary from "@/components/shared/FormErrorSummary";
import MaskedInput from "@/components/shared/MaskedInput";
import { normalizeDigits } from "@/lib/utils/validation";
import useFieldValidation from "@/hooks/useFieldValidation";
import useUnsavedChangesWarning from "@/hooks/useUnsavedChangesWarning";
import { createDoctor } from "@/features/admin/actions";
import { doctorSchema } from "@/features/admin/schemas";

const GENERIC_ERROR = "ثبت پزشک با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";
const ERROR_MESSAGES = {
  INVALID_INPUT: "اطلاعات واردشده معتبر نیست.",
  DUPLICATE_LICENSE: "این شماره نظام پزشکی قبلاً ثبت شده است.",
  DUPLICATE_PHONE: "این شماره موبایل قبلاً ثبت شده است.",
  UNAUTHORIZED: "شما اجازه انجام این کار را ندارید.",
};
const FIELD_LABELS = {
  full_name: "نام و نام خانوادگی",
  phone: "شماره موبایل",
  medical_license_number: "شماره نظام پزشکی",
  specialty: "تخصص",
};
const FIELD_IDS = {
  full_name: "full_name",
  phone: "phone",
  medical_license_number: "medical_license_number",
  specialty: "specialty",
};

export default function DoctorForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    full_name: "",
    phone: "",
    medical_license_number: "",
    specialty: "",
  });
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const [summaryFocusKey, setSummaryFocusKey] = useState(0);

  const validators = useMemo(() => Object.fromEntries(
    Object.entries(doctorSchema.shape).map(([field, schema]) => [field, (value) => {
      const result = schema.safeParse(value);
      return result.success ? true : result.error.issues?.[0]?.message || "مقدار واردشده معتبر نیست.";
    }]),
  ), []);
  const validation = useFieldValidation(validators);
  const isDirty = Object.values(values).some((value) => String(value ?? "").length > 0);
  useUnsavedChangesWarning(isDirty);

  function handleChange(field, value) {
    // Normalize numeric identifiers only; preserve user-entered script in names/specialty.
    const normalized = ["phone", "medical_license_number"].includes(field)
      ? normalizeDigits(value)
      : String(value ?? "");
    const next = { ...values, [field]: normalized };
    setValues(next);
    validation.onChange(field, normalized, next);
    setFormError(null);
  }

  function handleBlur(field) {
    validation.onBlur(field, values[field], values);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const checked = validation.validateAll(values);
    if (!checked.valid) {
      setSummaryFocusKey((current) => current + 1);
      return;
    }

    const parsed = doctorSchema.safeParse(values);
    if (!parsed.success) {
      setSummaryFocusKey((current) => current + 1);
      return;
    }

    setFormError(null);
    setPending(true);
    try {
      const result = await createDoctor(parsed.data);
      if (result?.ok) {
        toast.success("پزشک با موفقیت ثبت شد.");
        router.push("/admin/doctors");
        return;
      }
      setFormError(ERROR_MESSAGES[result?.code] ?? GENERIC_ERROR);
    } catch {
      setFormError(GENERIC_ERROR);
    }
    setPending(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-lg space-y-5" aria-busy={pending}>
      <FormErrorSummary
        errors={validation.errors}
        fieldLabels={FIELD_LABELS}
        fieldIds={FIELD_IDS}
        focusOnRender={summaryFocusKey > 0}
        focusKey={summaryFocusKey}
      />
      <FormError>{formError}</FormError>

      <FormField id="full_name" label="نام و نام خانوادگی" error={validation.errors.full_name} required>
        <Input
          id="full_name"
          dir="auto"
          autoComplete="name"
          value={values.full_name}
          onChange={(event) => handleChange("full_name", event.target.value)}
          onBlur={() => handleBlur("full_name")}
          disabled={pending}
        />
      </FormField>

      <FormField id="phone" label="شماره موبایل" error={validation.errors.phone} required description="شماره را با ارقام فارسی یا لاتین وارد کنید.">
        <MaskedInput
          id="phone"
          mask="iranian-mobile"
          maxDigits={14}
          dir="ltr"
          className="tabular-nums text-start"
          placeholder="0912 123 4567"
          value={values.phone}
          onValueChange={(value) => handleChange("phone", value)}
          onBlur={() => handleBlur("phone")}
          disabled={pending}
        />
      </FormField>

      <FormField id="medical_license_number" label="شماره نظام پزشکی" error={validation.errors.medical_license_number} required>
        <Input
          id="medical_license_number"
          dir="ltr"
          className="tabular-nums text-start"
          inputMode="numeric"
          value={values.medical_license_number}
          onChange={(event) => handleChange("medical_license_number", event.target.value)}
          onBlur={() => handleBlur("medical_license_number")}
          disabled={pending}
        />
      </FormField>

      <FormField id="specialty" label="تخصص" error={validation.errors.specialty}>
        <Input
          id="specialty"
          dir="auto"
          value={values.specialty}
          onChange={(event) => handleChange("specialty", event.target.value)}
          onBlur={() => handleBlur("specialty")}
          disabled={pending}
        />
      </FormField>

      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending} loading={pending} loadingText="در حال ثبت…">
        افزودن پزشک
      </Button>
    </form>
  );
}
