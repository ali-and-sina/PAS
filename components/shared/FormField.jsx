import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Accessible wrapper for one control with persistent help and inline errors. */
export default function FormField({
  id,
  label,
  description,
  helperText,
  error,
  required = false,
  className,
  labelClassName,
  children,
}) {
  const generatedId = React.useId();
  const childId = React.isValidElement(children) ? children.props.id : undefined;
  const controlId = id || childId || `field-${generatedId}`;
  const helpId = description || helperText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [
    React.isValidElement(children) ? children.props["aria-describedby"] : undefined,
    helpId,
    errorId,
  ].filter(Boolean).join(" ") || undefined;
  const labelId = label ? `${controlId}-label` : undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: controlId,
        "aria-labelledby": [children.props["aria-labelledby"], labelId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-describedby": describedBy,
        "aria-errormessage": errorId || children.props["aria-errormessage"],
        "aria-required": required || children.props["aria-required"] || undefined,
        required: required || children.props.required,
      })
    : children;

  return (
    <div className={cn("grid min-w-0 gap-2", className)} data-invalid={error ? "true" : undefined}>
      {label ? (
        <Label id={labelId} htmlFor={controlId} className={cn("leading-5", labelClassName)}>
          {label}
          {required ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}
        </Label>
      ) : null}
      {control}
      {description || helperText ? (
        <p id={helpId} className="text-xs leading-5 text-muted-foreground">{description || helperText}</p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-destructive">
          {typeof error === "string" ? error : "مقدار واردشده معتبر نیست."}
        </p>
      ) : null}
    </div>
  );
}
