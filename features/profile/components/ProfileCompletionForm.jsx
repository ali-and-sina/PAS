"use client";

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
import FormError from "@/components/shared/FormError";
import { cn } from "@/lib/utils";
import { getFieldErrors } from "@/lib/utils/validation";
import { updateOwnProfile } from "@/features/profile/actions";
import { profileNameSchema } from "@/features/profile/schemas";

const SAVE_ERROR = "ذخیره مشخصات با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";

/** First-run profile step for a new patient (full name only for now). */
export default function ProfileCompletionForm({ redirectTo }) {
  const router = useRouter();
  const inputRef = useRef(null);

  const [fullName, setFullName] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const parsed = profileNameSchema.safeParse({ full_name: fullName });
    if (!parsed.success) {
      setFieldError(getFieldErrors(parsed.error).full_name ?? SAVE_ERROR);
      inputRef.current?.focus();
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      const result = await updateOwnProfile(parsed.data);

      if (result?.ok) {
        toast.success("مشخصات شما ذخیره شد.");
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setFormError(
        result?.code === "INVALID_INPUT"
          ? "نام واردشده معتبر نیست. آن را بررسی کنید."
          : SAVE_ERROR,
      );
    } catch {
      setFormError(SAVE_ERROR);
    }

    setPending(false);
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
          برای ادامه، نام و نام خانوادگی خود را وارد کنید.
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

          <div className="space-y-2">
            <Label htmlFor="full_name">نام و نام خانوادگی</Label>
            <Input
              id="full_name"
              name="full_name"
              ref={inputRef}
              type="text"
              dir="auto"
              autoComplete="name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "full_name-error" : undefined}
              className={cn("h-11", fieldError && "border-destructive")}
            />
            {fieldError && (
              <p
                id="full_name-error"
                className="flex items-center gap-1.5 text-sm text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {fieldError}
              </p>
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
