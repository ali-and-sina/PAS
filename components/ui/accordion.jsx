import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const AccordionContext = React.createContext({ type: "single", rootRef: null });

/** Native disclosure-based accordion with optional single-open behavior. */
const Accordion = React.forwardRef(({ className, type = "single", children, ...props }, forwardedRef) => {
  const rootRef = React.useRef(null);
  const setRefs = React.useCallback((node) => {
    rootRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  return (
    <AccordionContext.Provider value={{ type, rootRef }}>
      <div ref={setRefs} className={cn("divide-y divide-border rounded-xl border", className)} data-accordion-type={type} {...props}>{children}</div>
    </AccordionContext.Provider>
  );
});
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef(({ className, value, onToggle, ...props }, ref) => {
  const context = React.useContext(AccordionContext);
  const handleToggle = (event) => {
    onToggle?.(event);
    if (event.currentTarget.open && context.type === "single") {
      context.rootRef?.current?.querySelectorAll("details[open]").forEach((item) => {
        if (item !== event.currentTarget) item.open = false;
      });
    }
  };
  return <details ref={ref} className={cn("group min-w-0", className)} data-value={value} onToggle={handleToggle} {...props} />;
});
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <summary ref={ref} className={cn("flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden", className)} {...props}>
    <span className="min-w-0">{children}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
  </summary>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pb-4 pt-1 text-sm leading-7 text-muted-foreground", className)} {...props}>{children}</div>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
