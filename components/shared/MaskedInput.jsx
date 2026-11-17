"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatMaskedValue, parseMaskedValue, sanitizeMaskedValue } from "@/lib/utils/masked-input.mjs";

const MASK_INPUT_MODES = {
  "iranian-mobile": "tel",
  "national-id": "numeric",
  integer: "numeric",
  money: "numeric",
};

const MaskedInput = React.forwardRef(function MaskedInput({
  mask,
  value,
  defaultValue = "",
  onChange,
  onValueChange,
  onBlur,
  onFocus,
  maxDigits,
  inputMode,
  ...props
}, ref) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => sanitizeMaskedValue(defaultValue, mask, maxDigits));
  const [focused, setFocused] = React.useState(false);
  const rawValue = sanitizeMaskedValue(controlled ? value : internalValue, mask, maxDigits);
  const displayValue = focused ? rawValue : formatMaskedValue(rawValue, mask, maxDigits);

  const handleChange = (event) => {
    const nextRaw = sanitizeMaskedValue(event.target.value, mask, maxDigits);
    if (!controlled) setInternalValue(nextRaw);
    onChange?.(event);
    onValueChange?.(nextRaw);
  };

  const handleFocus = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode || MASK_INPUT_MODES[mask] || "text"}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      autoComplete={props.autoComplete || (mask === "iranian-mobile" ? "tel" : "off")}
    />
  );
});

MaskedInput.displayName = "MaskedInput";
export default MaskedInput;
