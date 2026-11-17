/**
 * Small framework-agnostic validation helpers used by reusable form UI.
 * Validators are synchronous and must return true/null/undefined for success,
 * false for a generic failure, or a Persian user-facing message for failure.
 */
export function validationMessage(result) {
  if (result === true || result === null || result === undefined) return "";
  if (result === false) return "مقدار واردشده معتبر نیست.";
  if (typeof result === "string") return result.trim();
  if (typeof result === "object" && typeof result.message === "string") {
    return result.message.trim();
  }
  return "";
}

export function validateValues(values = {}, validators = {}) {
  const errors = {};

  for (const [field, validator] of Object.entries(validators)) {
    if (typeof validator !== "function") continue;
    let message = "";

    try {
      message = validationMessage(validator(values[field], values));
    } catch {
      // Validator implementation details should never be exposed to the UI.
      message = "اعتبارسنجی این فیلد انجام نشد. دوباره تلاش کنید.";
    }

    if (message) errors[field] = message;
  }

  return errors;
}
