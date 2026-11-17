"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cva } from "class-variance-authority";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef(({ className, readOnly = false, disabled, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} disabled={readOnly || disabled} aria-readonly={readOnly || undefined} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const radioItemVariants = cva(
  "shrink-0 rounded-full border border-input bg-card text-primary shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
  { variants: { size: { sm: "size-4", md: "size-5", lg: "size-6" } }, defaultVariants: { size: "md" } },
);

const RadioGroupItem = React.forwardRef(({ className, size, readOnly = false, disabled, ...props }, ref) => (
  <RadioGroupPrimitive.Item ref={ref} disabled={readOnly || disabled} aria-readonly={readOnly || undefined} className={cn(radioItemVariants({ size }), className)} {...props}>
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center"><Circle className="size-2.5 fill-current" aria-hidden="true" /></RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem, radioItemVariants };
