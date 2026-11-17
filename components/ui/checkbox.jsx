"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cva } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  "grid shrink-0 place-content-center rounded-md border border-input bg-card shadow-sm transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
  { variants: { size: { sm: "size-4", md: "size-5", lg: "size-6" } }, defaultVariants: { size: "md" } },
);

const Checkbox = React.forwardRef(({ className, size, readOnly = false, disabled, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const state = checked !== undefined ? checked : defaultChecked;
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={readOnly || disabled}
      aria-readonly={readOnly || undefined}
      onCheckedChange={readOnly ? undefined : onCheckedChange}
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {state === "indeterminate" ? <Minus className="size-4" strokeWidth={2.5} aria-hidden="true" /> : <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants };
