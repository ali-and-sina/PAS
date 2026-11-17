"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchTrackVariants = cva(
  "relative inline-flex shrink-0 items-center rounded-full border border-transparent bg-muted p-0.5 transition-colors duration-150 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
        lg: "h-7 w-[3.25rem]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchThumbVariants = cva(
  "pointer-events-none absolute start-0.5 top-1/2 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform duration-150",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchThumbPosition = {
  sm: "translate-x-4 rtl:-translate-x-4",
  md: "translate-x-5 rtl:-translate-x-5",
  lg: "translate-x-6 rtl:-translate-x-6",
};

const Switch = React.forwardRef(({
  className, size = "md", checked, defaultChecked = false, onCheckedChange,
  disabled = false, readOnly = false, required = false, id, name, value = "on", ...props
}, ref) => {
  const controlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked));
  const isChecked = controlled ? Boolean(checked) : internalChecked;
  const isDisabled = Boolean(disabled || readOnly);
  const handleClick = () => {
    if (isDisabled) return;
    const next = !isChecked;
    if (!controlled) setInternalChecked(next);
    onCheckedChange?.(next);
  };

  return (
    <span className={cn("inline-flex min-h-11 min-w-11 items-center", isDisabled && "cursor-not-allowed opacity-60")}>
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-readonly={readOnly || undefined}
        aria-required={required || undefined}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(switchTrackVariants({ size }), className)}
        {...props}
      >
        <span aria-hidden="true" className={cn(switchThumbVariants({ size }), isChecked ? switchThumbPosition[size] : "translate-x-0")} />
      </button>
      {name ? <input type="checkbox" className="sr-only" tabIndex={-1} aria-hidden="true" name={name} value={value} checked={isChecked} readOnly required={required} disabled={disabled} /> : null}
    </span>
  );
});
Switch.displayName = "Switch";

export { Switch, switchTrackVariants, switchThumbVariants };
