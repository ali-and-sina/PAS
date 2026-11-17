"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SearchInput = React.forwardRef(({
  value,
  defaultValue,
  onChange,
  onValueChange,
  onDebouncedChange,
  debounceMs = 0,
  onClear,
  className,
  placeholder = "جست‌وجو…",
  clearLabel = "پاک کردن جست‌وجو",
  ...props
}, ref) => {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = controlled ? value : internalValue;
  const hasMounted = React.useRef(false);
  const debouncedCallbackRef = React.useRef(onDebouncedChange);

  React.useEffect(() => {
    debouncedCallbackRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    if (!controlled) setInternalValue(nextValue);
    onChange?.(event);
    onValueChange?.(nextValue);
  };

  const clear = () => {
    if (!controlled) setInternalValue("");
    onClear?.();
    onValueChange?.("");
  };

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return undefined;
    }
    if (typeof debouncedCallbackRef.current !== "function") return undefined;

    const delay = Number.isFinite(Number(debounceMs)) ? Math.max(0, Number(debounceMs)) : 0;
    const timer = window.setTimeout(() => debouncedCallbackRef.current?.(currentValue ?? ""), delay);
    return () => window.clearTimeout(timer);
  }, [currentValue, debounceMs]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        ref={ref}
        type="search"
        value={currentValue ?? ""}
        onChange={handleChange}
        placeholder={placeholder}
        startIcon={Search}
        className="pe-12"
        aria-label={props["aria-label"] || "جست‌وجو"}
        {...props}
      />
      {currentValue ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clear}
          className="absolute end-0 top-1/2 size-11 -translate-y-1/2"
          aria-label={clearLabel}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
});
SearchInput.displayName = "SearchInput";

export default SearchInput;
