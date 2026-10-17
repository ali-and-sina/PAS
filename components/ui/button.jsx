"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    type,
    loading = false,
    loadingText,
    disabled,
    onClick,
    children,
    ...props
  },
  forwardedRef,
) {
  const Comp = asChild ? Slot : "button";
  const formStatus = useFormStatus();
  const innerRef = React.useRef(null);
  const pendingObservedRef = React.useRef(false);
  const [interactionPending, setInteractionPending] = React.useState(false);
  const [wasPressed, setWasPressed] = React.useState(false);
  const isSubmitButton = !asChild && (type === "submit" || type === undefined);
  const formActionPending = isSubmitButton && formStatus.pending;
  const externallyBusy =
    props["aria-busy"] === true || props["aria-busy"] === "true";

  const setRefs = React.useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const hasMultipleSubmitters = React.useCallback(() => {
    const form = innerRef.current?.form;
    if (!form) return false;
    return (
      form.querySelectorAll('button[type="submit"], button:not([type])')
        .length > 1
    );
  }, []);

  const showFormSpinner = Boolean(
    formActionPending && (wasPressed || !hasMultipleSubmitters()),
  );
  const isBusy = Boolean(
    loading || externallyBusy || showFormSpinner || interactionPending,
  );
  const isDisabled = Boolean(
    disabled ||
    loading ||
    externallyBusy ||
    formActionPending ||
    interactionPending,
  );

  React.useEffect(() => {
    if (formStatus.pending) {
      pendingObservedRef.current = true;
    } else if (pendingObservedRef.current) {
      pendingObservedRef.current = false;
      setWasPressed(false);
    }
  }, [formStatus.pending]);

  const handleClick = React.useCallback(
    (event) => {
      if (disabled || isDisabled) return;
      if (isSubmitButton && innerRef.current?.form) setWasPressed(true);
      if (typeof onClick !== "function") return;

      const result = onClick(event);
      if (result && typeof result.then === "function") {
        setInteractionPending(true);
        Promise.resolve(result).then(
          () => setInteractionPending(false),
          () => setInteractionPending(false),
        );
      }
    },
    [disabled, isDisabled, isSubmitButton, onClick],
  );

  const buttonContent =
    isBusy && !asChild ? (
      <>
        <span className="pas-button-spinner" aria-hidden="true" />
        <span>{loadingText || children}</span>
      </>
    ) : (
      children
    );

  return (
    <Comp
      {...props}
      className={cn(buttonVariants({ variant, size, className }))}
      ref={setRefs}
      {...(!asChild && type !== undefined ? { type } : {})}
      disabled={asChild ? disabled : isDisabled}
      onClick={onClick || isSubmitButton ? handleClick : undefined}
      aria-busy={isBusy ? true : props["aria-busy"]}
    >
      {buttonContent}
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
