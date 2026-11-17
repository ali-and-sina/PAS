"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { SpinnerGraphic, useDelayedLoading } from "@/components/shared/Spinner";

const buttonVariants = cva(
  "relative inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]",
        admin: "bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
        outline: "border border-input bg-card text-foreground shadow-sm hover:border-primary hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        neutral: "border border-input bg-card text-foreground hover:bg-muted active:bg-muted/80",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        md: "min-h-11 px-4 py-2.5",
        sm: "min-h-11 rounded-lg px-3 py-2 text-sm",
        lg: "min-h-12 rounded-xl px-6 py-3 text-base",
        icon: "size-11 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function flattenSlotChildren(children) {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenSlotChildren(child.props.children);
    }
    if (typeof child === "string" && child.trim() === "") return [];
    return child == null || typeof child === "boolean" ? [] : [child];
  });
}

function normalizeSlottedChild(children) {
  const nodes = flattenSlotChildren(children);
  const targetIndex = nodes.findIndex(React.isValidElement);
  if (targetIndex < 0) return null;
  const target = nodes[targetIndex];
  const siblings = nodes.filter((_, index) => index !== targetIndex);
  if (!siblings.length) return target;
  const mergedChildren = [...flattenSlotChildren(target.props.children), ...siblings];
  return React.cloneElement(target, undefined, mergedChildren.length === 1 ? mergedChildren[0] : mergedChildren);
}

const Button = React.forwardRef(function Button(
  {
    className, variant, size, asChild = false, type, loading = false,
    loadingText, disabled, onClick, children, ...props
  },
  forwardedRef,
) {
  const slottedChild = asChild ? normalizeSlottedChild(children) : null;
  const canSlot = Boolean(asChild && React.isValidElement(slottedChild));
  const Comp = canSlot ? Slot : "button";
  const formStatus = useFormStatus();
  const innerRef = React.useRef(null);
  const pendingObservedRef = React.useRef(false);
  const pendingLockRef = React.useRef(false);
  const [interactionPending, setInteractionPending] = React.useState(false);
  const [wasPressed, setWasPressed] = React.useState(false);
  const isSubmitButton = !canSlot && (type === "submit" || type === undefined);
  const formActionPending = isSubmitButton && formStatus.pending;
  const externallyBusy = props["aria-busy"] === true || props["aria-busy"] === "true";
  const hasMultipleSubmitters = (innerRef.current?.form?.querySelectorAll('button[type="submit"],button:not([type])').length || 0) > 1;
  const showFormSpinner = Boolean(formActionPending && (wasPressed || !hasMultipleSubmitters));
  const isBusy = Boolean(loading || externallyBusy || showFormSpinner || interactionPending);
  const spinnerVisible = useDelayedLoading(isBusy, 250, 400);
  const isDisabled = Boolean(disabled || isBusy || spinnerVisible || formActionPending || props["aria-disabled"] === true || props["aria-disabled"] === "true");

  const setRefs = React.useCallback((node) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  React.useEffect(() => {
    if (formStatus.pending) pendingObservedRef.current = true;
    else if (pendingObservedRef.current) {
      pendingObservedRef.current = false;
      pendingLockRef.current = false;
      setWasPressed(false);
    }
  }, [formStatus.pending]);

  const handleClick = React.useCallback((event) => {
    if (isDisabled || pendingLockRef.current) {
      if (canSlot) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (isSubmitButton && innerRef.current?.form) setWasPressed(true);
    if (pendingLockRef.current) return;

    const childHandler = canSlot ? slottedChild.props.onClick : undefined;
    let childResult;
    if (typeof childHandler === "function") childResult = childHandler(event);
    if (event.defaultPrevented) return;

    let result = childResult;
    if (typeof onClick === "function") result = onClick(event) ?? result;
    if (result && typeof result.then === "function") {
      pendingLockRef.current = true;
      setInteractionPending(true);
      Promise.resolve(result).then(
        () => { pendingLockRef.current = false; setInteractionPending(false); },
        () => { pendingLockRef.current = false; setInteractionPending(false); },
      );
    }
  }, [canSlot, isDisabled, isSubmitButton, onClick, slottedChild]);

  const slotChild = canSlot
    ? React.cloneElement(slottedChild, { onClick: undefined })
    : null;

  const content = (
    <>
      <span className={cn("inline-flex items-center justify-center gap-2", spinnerVisible && "opacity-0")}>
        {canSlot ? slotChild.props.children : children}
      </span>
      {spinnerVisible ? (
        <span className="absolute inset-0 flex items-center justify-center text-current" aria-hidden="true">
          <SpinnerGraphic size="sm" />
        </span>
      ) : null}
      {isBusy && loadingText ? <span className="sr-only">{loadingText}</span> : null}
    </>
  );

  return (
    <Comp
      {...props}
      className={cn(buttonVariants({ variant, size, className }), canSlot && isDisabled && "pointer-events-none opacity-50")}
      ref={setRefs}
      {...(!canSlot && type !== undefined ? { type } : {})}
      disabled={canSlot ? undefined : isDisabled}
      tabIndex={canSlot && isDisabled ? -1 : props.tabIndex}
      onClick={handleClick}
      aria-disabled={canSlot && isDisabled ? true : props["aria-disabled"]}
      aria-busy={isBusy || spinnerVisible ? true : props["aria-busy"]}
      aria-label={(isBusy || spinnerVisible) && loadingText ? loadingText : props["aria-label"]}
    >
      {canSlot ? React.cloneElement(slotChild, {}, content) : content}
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
