"use client";

import * as React from "react";
import { validationMessage, validateValues } from "@/lib/utils/form-validation.mjs";

/**
 * Reusable blur-first validation state for UI forms.
 * Validators return true/null/undefined for success or a Persian message for failure.
 * Server-side validation remains authoritative.
 */
export default function useFieldValidation(validators = {}) {
  const validatorsRef = React.useRef(validators);
  const touchedRef = React.useRef({});
  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});

  React.useEffect(() => { validatorsRef.current = validators; }, [validators]);

  const validateField = React.useCallback((field, value, values = { [field]: value }) => {
    const validator = validatorsRef.current?.[field];
    if (typeof validator !== "function") {
      setErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
      return true;
    }

    let message = "";
    try {
      message = validationMessage(validator(value, values));
    } catch {
      message = "اعتبارسنجی این فیلد انجام نشد. دوباره تلاش کنید.";
    }

    setErrors((current) => {
      if (!message && !(field in current)) return current;
      if (message && current[field] === message) return current;
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });

    return !message;
  }, []);

  const onBlur = React.useCallback((field, value, values) => {
    if (!touchedRef.current[field]) {
      touchedRef.current = { ...touchedRef.current, [field]: true };
      setTouched(touchedRef.current);
    }
    return validateField(field, value, values);
  }, [validateField]);

  const onChange = React.useCallback((field, value, values) => {
    if (!touchedRef.current[field]) return true;
    return validateField(field, value, values);
  }, [validateField]);

  const validateAll = React.useCallback((values = {}) => {
    const activeValidators = validatorsRef.current || {};
    const nextErrors = validateValues(values, activeValidators);
    const nextTouched = Object.fromEntries(Object.keys(activeValidators).map((field) => [field, true]));
    touchedRef.current = nextTouched;
    setErrors(nextErrors);
    setTouched(nextTouched);
    const firstInvalidField = Object.keys(nextErrors)[0] || null;
    return { valid: !firstInvalidField, errors: nextErrors, firstInvalidField };
  }, []);

  const resetValidation = React.useCallback(() => {
    touchedRef.current = {};
    setErrors({});
    setTouched({});
  }, []);

  return { errors, touched, validateField, onBlur, onChange, validateAll, resetValidation };
}
