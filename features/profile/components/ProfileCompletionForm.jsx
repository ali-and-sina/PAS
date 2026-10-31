"use client";
import { JalaliDateField } from "@/components/care/JalaliCalendar";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getFieldErrors } from "@/lib/utils/validation";
import FormError from "@/components/shared/FormError";

import { updateOwnProfile } from "@/features/profile/actions";
import { patientProfileCompletionSchema } from "@/features/profile/schemas";

const SAVE_ERROR = "ذخیره مشخصات با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";

export default function ProfileCompletionForm({ redirectTo }) {
  const router = useRouter();

  const fullNameRef = useRef(null);
  const dateOfBirthRef = useRef(null);
  const sexRef = useRef(null);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const parsed = patientProfileCompletionSchema.safeParse({
      full_name: fullName,
      date_of_birth: dateOfBirth,
      sex,
    });

    if (!parsed.success) {
      const errors = getFieldErrors(parsed.error);

      setFieldErrors(errors);
      setFormError(null);

      if (errors.full_name) {
        fullNameRef.current?.focus();
      } else if (errors.date_of_birth) {
        dateOfBirthRef.current?.focus();
      } else if (errors.sex) {
        sexRef.current?.focus();
      }

      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const result = await updateOwnProfile(parsed.data);

      if (result?.ok) {
        toast.success("مشخصات شما ذخیره شد.");

        router.replace(redirectTo);

        return;
      }

      if (result?.code === "INVALID_INPUT") {
        setFormError(
          "اطلاعات واردشده معتبر نیست. لطفاً موارد واردشده را بررسی کنید.",
        );
      } else {
        setFormError(SAVE_ERROR);
      }
    } catch {
      setFormError(SAVE_ERROR);
    }

    setPending(false);
  }

  function clearFieldError(name) {
    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const next = { ...current };
      delete next[name];

      return next;
    });
  }

  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader className="space-y-2 text-center">
        <h1
          id="profile-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          تکمیل مشخصات
        </h1>

        <CardDescription className="leading-relaxed">
          برای ادامه، نام، تاریخ تولد و جنسیت خود را وارد کنید.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby="profile-heading"
          className="space-y-5"
        >
          <FormError>{formError}</FormError>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">نام و نام خانوادگی</Label>

            <Input
              id="full_name"
              name="full_name"
              ref={fullNameRef}
              type="text"
              dir="auto"
              autoComplete="name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                clearFieldError("full_name");
              }}
              aria-invalid={fieldErrors.full_name ? true : undefined}
              aria-describedby={
                fieldErrors.full_name ? "full_name-error" : undefined
              }
              className={cn(
                "h-11",
                fieldErrors.full_name && "border-destructive",
              )}
            />

            {fieldErrors.full_name && (
              <FieldError
                id="full_name-error"
                message={fieldErrors.full_name}
              />
            )}
          </div>

          {/* Date of birth */}
          <div className="space-y-2">
            <JalaliDateField id="date_of_birth" name="date_of_birth" label="تاریخ تولد" birthDate buttonRef={dateOfBirthRef} value={dateOfBirth} onChange={value=>{setDateOfBirth(value);clearFieldError("date_of_birth");}} invalid={Boolean(fieldErrors.date_of_birth)} describedBy={fieldErrors.date_of_birth?"date_of_birth-error":undefined} />

            {fieldErrors.date_of_birth && (
              <FieldError
                id="date_of_birth-error"
                message={fieldErrors.date_of_birth}
              />
            )}
          </div>

          {/* Sex */}
          <div className="space-y-2">
            <Label htmlFor="sex">جنسیت</Label>

            <select
              id="sex"
              name="sex"
              ref={sexRef}
              value={sex}
              onChange={(event) => {
                setSex(event.target.value);
                clearFieldError("sex");
              }}
              aria-invalid={fieldErrors.sex ? true : undefined}
              aria-describedby={fieldErrors.sex ? "sex-error" : undefined}
              className={cn(
                "flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring",
                fieldErrors.sex && "border-destructive",
              )}
            >
              <option value="">انتخاب کنید</option>

              <option value="male">مرد</option>

              <option value="female">زن</option>
            </select>

            {fieldErrors.sex && (
              <FieldError id="sex-error" message={fieldErrors.sex} />
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "در حال ذخیره..." : "ذخیره و ادامه"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ id, message }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />

      {message}
    </p>
  );
}
