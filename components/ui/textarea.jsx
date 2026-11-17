import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-28 w-full resize-y rounded-xl border border-input bg-card px-3.5 py-3 text-base leading-7 text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive read-only:bg-muted/40 md:text-sm",
  { variants: { size: { sm: "min-h-20 text-sm", md: "min-h-28", lg: "min-h-36" } }, defaultVariants: { size: "md" } },
);

const Textarea = React.forwardRef(({ className, size, startIcon: StartIcon, endIcon: EndIcon, iconStart, iconEnd, ...props }, ref) => {
  const LeadingIcon = StartIcon || iconStart;
  const TrailingIcon = EndIcon || iconEnd;
  const textarea = (
    <textarea
      ref={ref}
      className={cn(textareaVariants({ size }), LeadingIcon && "ps-10", TrailingIcon && "pe-10", className)}
      {...props}
    />
  );
  if (!LeadingIcon && !TrailingIcon) return textarea;
  return (
    <span className="relative block w-full">
      {LeadingIcon ? <LeadingIcon className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /> : null}
      {textarea}
      {TrailingIcon ? <TrailingIcon className="pointer-events-none absolute end-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /> : null}
    </span>
  );
});
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
