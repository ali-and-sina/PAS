"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const PopoverContext = React.createContext(null);

function mergeRefs(...refs) {
  return (node) => refs.forEach((ref) => {
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  });
}

function usePopoverContext(component) {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error(`${component} must be used within <Popover>`);
  return context;
}

function Popover({ open: openProp, defaultOpen = false, onOpenChange, children }) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlled ? openProp : internalOpen;
  const [trigger, setTriggerState] = React.useState(null);
  const contentId = React.useId();
  const setOpen = React.useCallback((next) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);
  const contextValue = React.useMemo(() => ({
    open,
    setOpen,
    trigger,
    setTrigger: setTriggerState,
    contentId,
  }), [open, setOpen, trigger, contentId]);
  return <PopoverContext.Provider value={contextValue}>{children}</PopoverContext.Provider>;
}

const PopoverTrigger = React.forwardRef(({ asChild = false, className, children, onClick, ...props }, ref) => {
  const context = usePopoverContext("PopoverTrigger");
  const setTrigger = context.setTrigger;
  const localRef = React.useCallback((node) => {
    setTrigger(node);
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [setTrigger, ref]);
  const childRef = asChild && React.isValidElement(children) ? children.props.ref : null;
  const mergedChildRef = React.useMemo(() => mergeRefs(localRef, childRef), [localRef, childRef]);
  const handleClick = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) context.setOpen(!context.open);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: cn(children.props.className, className),
      ref: mergedChildRef,
      onClick: (event) => { children.props.onClick?.(event); if (!event.defaultPrevented) handleClick(event); },
      "aria-haspopup": "dialog",
      "aria-expanded": context.open,
      "aria-controls": context.contentId,
    });
  }
  return <button ref={localRef} type="button" className={className} onClick={handleClick} aria-haspopup="dialog" aria-expanded={context.open} aria-controls={context.contentId} {...props}>{children}</button>;
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef(({ className, align = "start", sideOffset = 8, children, onEscapeKeyDown, style, "aria-label": ariaLabel, ...props }, forwardedRef) => {
  const context = usePopoverContext("PopoverContent");
  const contentRef = React.useRef(null);
  const [position, setPosition] = React.useState({ top: -10000, left: -10000, visibility: "hidden" });
  const setRefs = React.useCallback((node) => {
    contentRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  React.useEffect(() => {
    if (!context.open || !context.trigger || !contentRef.current) return undefined;
    const updatePosition = () => {
      const anchor = context.trigger.getBoundingClientRect();
      const panel = contentRef.current?.getBoundingClientRect();
      if (!panel) return;
      const margin = 12;
      const below = window.innerHeight - anchor.bottom;
      const above = anchor.top;
      const placeAbove = below < panel.height + sideOffset + margin && above > below;
      let top = placeAbove ? anchor.top - panel.height - sideOffset : anchor.bottom + sideOffset;
      const direction = window.getComputedStyle(context.trigger).direction;
      const startIsRight = direction === "rtl";
      let left = align === "center" ? anchor.left + (anchor.width - panel.width) / 2 : (align === "end") !== startIsRight ? anchor.right - panel.width : anchor.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - panel.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - panel.height - margin));
      setPosition((current) => (
        current.top === top && current.left === left && current.visibility === "visible"
          ? current
          : { top, left, visibility: "visible" }
      ));
    };
    updatePosition();
    const focusTarget = contentRef.current?.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus({ preventScroll: true });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null;
    resizeObserver?.observe(contentRef.current);
    resizeObserver?.observe(context.trigger);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [context.open, context.trigger, align, sideOffset]);

  React.useEffect(() => {
    if (!context.open) return undefined;
    const onPointerDown = (event) => {
      if (!contentRef.current?.contains(event.target) && !context.trigger?.contains(event.target)) context.setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onEscapeKeyDown?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(false);
          context.trigger?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [context.open, context.setOpen, context.trigger, onEscapeKeyDown]);

  if (!context.open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={setRefs} id={context.contentId} role="dialog" aria-label={ariaLabel || "محتوای بیشتر"} tabIndex={-1} data-state="open" className={cn("fixed z-dropdown max-h-[min(24rem,calc(100vh-1.5rem))] min-w-48 max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-pas-3 outline-none", className)} style={{ ...style, ...position }} {...props}>{children}</div>,
    document.body,
  );
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
