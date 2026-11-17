import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success/25 bg-success/10 text-success-foreground",
        warning: "border-warning/30 bg-warning/10 text-warning-foreground",
        info: "border-info/25 bg-info/10 text-info-foreground",
        neutral: "border-border bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.6875rem]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

const Badge = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";
  return <Comp ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />;
});
Badge.displayName = "Badge";

const Tag = React.forwardRef(({ className, ...props }, ref) => (
  <Badge ref={ref} variant="outline" className={cn("font-medium", className)} {...props} />
));
Tag.displayName = "Tag";

export { Badge, Tag, badgeVariants };
