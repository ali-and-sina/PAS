"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-input bg-card text-foreground shadow-sm hover:border-primary hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-11 rounded-lg px-3 py-2 text-sm",
        lg: "min-h-12 rounded-xl px-6 py-3 text-base",
        icon: "size-[44px] shrink-0",
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
