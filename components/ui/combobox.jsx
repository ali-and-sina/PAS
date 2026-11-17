"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const comboboxInputVariants = cva(
  "min-h-11 w-full rounded-xl border border-input bg-card py-2 pe-16 ps-10 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  { variants: { size: { sm: "min-h-9 text-sm", md: "min-h-11", lg: "min-h-12 py-2.5 text-base" } }, defaultVariants: { size: "md" } },
);

/** Lightweight accessible combobox for modest, already-loaded option lists. */
const Combobox = React.forwardRef(({
  id, size, value: valueProp, defaultValue = "", onValueChange, onChange,
  options = [], placeholder = "انتخاب کنید…", emptyMessage = "موردی پیدا نشد.",
  disabled = false, readOnly = false, invalid = false, className, name, allowClear = true,
  inputProps = {}, ...props
}, forwardedRef) => {
  const inputId = id || React.useId();
  const listId = `${inputId}-listbox`;
  const controlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = controlled ? valueProp : internalValue;
  const [query, setQuery] = React.useState(() => options.find((item) => item.value === value)?.label || "");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const wrapperRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const visibleOptions = options.filter((option) => String(option.label ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    setQuery(selected?.label || "");
  }, [selected?.label, value]);
  React.useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  const commit = (option) => {
    if (!option || option.disabled) return;
    if (!controlled) setInternalValue(option.value);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(-1);
    onValueChange?.(option.value, option);
    onChange?.(option.value, option);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const start = current < 0 ? (direction === 1 ? -1 : 0) : current;
        if (!visibleOptions.length) return -1;
        for (let step = 1; step <= visibleOptions.length; step += 1) {
          const next = (start + direction * step + visibleOptions.length) % visibleOptions.length;
          if (!visibleOptions[next]?.disabled) return next;
        }
        return -1;
      });
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      commit(visibleOptions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      setQuery(selected?.label || "");
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative min-w-0", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          {...inputProps}
          {...props}
          ref={(node) => {
            inputRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          value={query}
          placeholder={placeholder}
          onFocus={() => { if (!readOnly) setOpen(true); }}
          onClick={() => { if (!readOnly) setOpen(true); }}
          onChange={(event) => { if (readOnly) return; setQuery(event.target.value); setOpen(true); setActiveIndex(-1); if (!event.target.value) commit({ value: "", label: "" }); }}
          onKeyDown={handleKeyDown}
          className={comboboxInputVariants({ size })}
        />
        <span className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {allowClear && query && !disabled && !readOnly ? <button type="button" onClick={() => { setQuery(""); if (!controlled) setInternalValue(""); onValueChange?.(""); onChange?.(""); inputRef.current?.focus(); setOpen(true); }} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="پاک کردن انتخاب"><X className="size-4" /></button> : null}
          <ChevronDown className={cn("size-4 text-muted-foreground", readOnly && "opacity-40")} aria-hidden="true" />
        </span>
      </div>
      {open && !disabled && !readOnly ? (
        <ul id={listId} role="listbox" aria-label={props["aria-label"] || "گزینه‌ها"} className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-dropdown max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-pas-3">
          {visibleOptions.length ? visibleOptions.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(option)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn("flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm outline-none transition-colors hover:bg-accent", activeIndex === index && "bg-accent", option.disabled && "pointer-events-none opacity-50", option.value === value && "font-medium text-primary")}
            >
              <span>{option.label}</span>{option.value === value ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
            </li>
          )) : <li role="status" className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</li>}
        </ul>
      ) : null}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </div>
  );
});
Combobox.displayName = "Combobox";

export { Combobox, comboboxInputVariants };
