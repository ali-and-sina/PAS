import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-xl border border-input bg-card text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive read-only:bg-muted/40",
  {
    variants: {
      size: {
        sm: "min-h-9 px-3 py-1.5 text-sm",
        md: "min-h-11 px-3.5 py-2 text-base md:text-sm",
        lg: "min-h-12 px-4 py-2.5 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const Input = React.forwardRef(({
  className, type = "text", size, startIcon: StartIcon, endIcon: EndIcon,
  iconStart, iconEnd, ...props
}, ref) => {
  const LeadingIcon = StartIcon || iconStart;
  const TrailingIcon = EndIcon || iconEnd;
  const input = (
    <input
      ref={ref}
      type={type}
      className={cn(inputVariants({ size }), LeadingIcon && "ps-10", TrailingIcon && "pe-10", className)}
      {...props}
    />
  );

  if (!LeadingIcon && !TrailingIcon) return input;
  return (
    <span className="relative block w-full">
      {LeadingIcon ? <LeadingIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /> : null}
      {input}
      {TrailingIcon ? <TrailingIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /> : null}
    </span>
  );
});
Input.displayName = "Input";

export { Input, inputVariants };
