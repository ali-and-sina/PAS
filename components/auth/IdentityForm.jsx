"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import FormError from "@/components/shared/FormError";

function TextField({
  id,
  label,
  error,
  hint,
  inputRef,
  className,
  ...inputProps
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        dir="ltr"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 rounded-xl bg-background/70 tabular-nums transition-[border-color,box-shadow,background-color] duration-200 focus-visible:bg-background motion-reduce:transition-none",
          className,
          error && "border-destructive",
        )}
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
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function IdentityForm({
  config,
  values,
  errors,
  formError,
  pending,
  onChange,
  onSubmit,
  onBack,
  focusRequest,
  labelledBy,
}) {
  const identifierRef = useRef(null);
  const phoneRef = useRef(null);
  const summaryRef = useRef(null);
  const handledFocusRequest = useRef(0);
  const { identifier } = config;

  // Start on the first field when the step opens.
  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  // After a failed validation, move focus to the first invalid field (once per attempt).
  useEffect(() => {
    if (focusRequest === handledFocusRequest.current) return;
    handledFocusRequest.current = focusRequest;
    if (errors.identifier && errors.phone) summaryRef.current?.focus();
    else if (errors.identifier) identifierRef.current?.focus();
    else if (errors.phone) phoneRef.current?.focus();
  }, [focusRequest, errors]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={labelledBy}
      className="space-y-5"
    >
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={pending}
          className="-ms-2 rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted/70 motion-reduce:transition-none"
        >
          <ArrowRight aria-hidden="true" />
          تغییر نقش
        </Button>
      )}

      <FormError>{formError}</FormError>

      {errors.identifier && errors.phone && <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="identity-error-title" className="rounded-xl border border-destructive/30 bg-status-critical-bg p-4 text-sm text-destructive"><h2 id="identity-error-title" className="font-semibold">این دو مورد را اصلاح کنید</h2><ul className="mt-2 list-inside list-disc space-y-1"><li><a href="#identifier" className="underline underline-offset-4">{errors.identifier}</a></li><li><a href="#phone" className="underline underline-offset-4">{errors.phone}</a></li></ul></div>}

      <TextField
        id="identifier"
        name="identifier"
        label={identifier.label}
        error={errors.identifier}
        inputRef={identifierRef}
        type="text"
        required
        inputMode={identifier.inputMode}
        autoComplete="off"
        placeholder={identifier.placeholder}
        value={values.identifier}
        onChange={(event) => onChange("identifier", event.target.value)}
      />

      <TextField
        id="phone"
        name="phone"
        label="شماره موبایل"
        hint="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
        error={errors.phone}
        inputRef={phoneRef}
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel"
        placeholder="09123456789"
        value={values.phone}
        onChange={(event) => onChange("phone", event.target.value)}
      />

      <Button
        type="submit"
        className="min-h-12 w-full rounded-xl shadow-sm"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "در حال بررسی..." : "دریافت کد ورود"}
      </Button>
    </form>
  );
}
