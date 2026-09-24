"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/utils/validation";

/**
 * One real <input> (paste, SMS autofill, screen readers all work natively)
 * with a row of visual cells drawn on top. Digits are always Latin.
 */
export default function OtpInput({
  id,
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  describedBy,
  inputRef,
}) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  function handleChange(event) {
    const digits = normalizeDigits(event.target.value)
      .replace(/\D/g, "")
      .slice(0, length);
    onChange(digits);
  }

  return (
    <div dir="ltr" className="relative mx-auto w-full max-w-xs">
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        value={value}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent opacity-0 caret-transparent"
      />
      <div className="flex justify-between gap-2" aria-hidden="true">
        {Array.from({ length }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center justify-center rounded-md border bg-card text-lg font-medium tabular-nums transition-colors",
              focused &&
                index === activeIndex &&
                "border-primary ring-2 ring-ring ring-offset-2 ring-offset-background",
              invalid && "border-destructive",
              disabled && "opacity-50",
            )}
          >
            {value[index] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
