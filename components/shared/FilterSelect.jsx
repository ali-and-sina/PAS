"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function FilterSelect({ value, onValueChange, options = [], placeholder = "همه موارد", disabled = false, className, ariaLabel = "فیلتر فهرست", ...props }) {
  return (
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled} {...props}>
      <SelectTrigger aria-label={ariaLabel} className={cn("min-w-[9rem]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
