"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import FormError from "@/components/shared/FormError";

function TextField({ id, label, error, hint, inputRef, ...inputProps }) {
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
        className={cn("h-11 tabular-nums", error && "border-destructive")}
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
    if (errors.identifier) identifierRef.current?.focus();
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={pending}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowRight aria-hidden="true" />
        تغییر نقش
      </Button>

      <FormError>{formError}</FormError>

      <TextField
        id="identifier"
        name="identifier"
        label={identifier.label}
        error={errors.identifier}
        inputRef={identifierRef}
        type="text"
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
        hint="با فرمت 09123456789 وارد کنید."
        error={errors.phone}
        inputRef={phoneRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="09123456789"
        value={values.phone}
        onChange={(event) => onChange("phone", event.target.value)}
      />

      <Button
        type="submit"
        className="h-11 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "در حال بررسی..." : "دریافت کد ورود"}
      </Button>
    </form>
  );
}
