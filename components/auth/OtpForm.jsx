"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  OTP_EXPIRY_SECONDS,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
} from "@/features/auth/config";
import FormError from "@/components/shared/FormError";
import OtpInput from "./OtpInput";

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Remount with a new `key` to restart the countdown. */
function ResendControl({ seconds, pending, onResend }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const endsAt = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  if (left > 0) {
    return (
      <p className="text-sm text-muted-foreground">
        ارسال مجدد کد تا{" "}
        <span dir="ltr" className="tabular-nums">
          {formatCountdown(left)}
        </span>{" "}
        دیگر
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onResend}
      disabled={pending}
    >
      ارسال مجدد کد
    </Button>
  );
}

export default function OtpForm({
  code,
  error,
  pending,
  isDevelopmentAuth,
  resendCount,
  onCodeChange,
  onSubmit,
  onBack,
  onResend,
  labelledBy,
}) {
  const inputRef = useRef(null);

  // Focus on open, after an error, and after a resend.
  useEffect(() => {
    inputRef.current?.focus();
  }, [error, resendCount]);

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
        تغییر شماره
      </Button>

      <FormError>{error}</FormError>

      <div className="space-y-3">
        <Label htmlFor="otp-code">کد تأیید</Label>
        <OtpInput
          id="otp-code"
          inputRef={inputRef}
          value={code}
          onChange={onCodeChange}
          length={OTP_LENGTH}
          invalid={Boolean(error)}
          describedBy="otp-hint"
        />
        <p id="otp-hint" className="text-center text-xs text-muted-foreground">
          کد {OTP_LENGTH} رقمی تا {Math.round(OTP_EXPIRY_SECONDS / 60)} دقیقه
          اعتبار دارد.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-accent px-3 py-2.5 text-sm text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1 leading-relaxed">
          <p>ارسال کد تأیید در نسخه نهایی فعال خواهد شد.</p>
          {isDevelopmentAuth && (
            <p className="text-xs">
              در حالت آزمایشی، برای شماره‌های تست تعریف‌شده در Supabase همان کد
              آزمایشی را وارد کنید.
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="h-11 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "در حال بررسی..." : "تأیید و ورود"}
      </Button>

      <div className="flex justify-center">
        <ResendControl
          key={resendCount}
          seconds={OTP_RESEND_SECONDS}
          pending={pending}
          onResend={onResend}
        />
      </div>
    </form>
  );
}
