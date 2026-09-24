/**
 * Pure validation / normalization helpers.
 *
 * No framework imports: safe on server and client, easy to unit-test.
 */

/**
 * Persian (۰-۹) and Arabic-Indic (٠-٩) digits → Latin digits.
 */
export function normalizeDigits(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Latin digits, with whitespace / zero-width / bidi control characters removed.
 */
export function cleanIdentifier(value) {
  return normalizeDigits(value).replace(
    /[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
    "",
  );
}

/**
 * Iranian national ID: 10 digits + mod-11 checksum.
 */
export function isValidIranianNationalId(value) {
  const id = cleanIdentifier(value);

  if (!/^\d{10}$/.test(id)) return false;

  // Reject IDs containing the same digit 10 times.
  if (/^(\d)\1{9}$/.test(id)) return false;

  const sum = id
    .slice(0, 9)
    .split("")
    .reduce((acc, digit, i) => acc + Number(digit) * (10 - i), 0);

  const remainder = sum % 11;
  const check = Number(id[9]);

  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/**
 * Normalize an Iranian mobile number.
 *
 * Accepted formats:
 *   09121234567
 *   9121234567
 *   989121234567
 *   +989121234567
 *   00989121234567
 *
 * Returns canonical E.164:
 *   +989121234567
 *
 * Returns null for invalid input.
 */
export function normalizeIranianMobile(value) {
  if (typeof value !== "string") return null;

  // Normalize Persian/Arabic digits first.
  // Keep only characters that are useful in phone notation.
  const cleaned = normalizeDigits(value)
    .replace(/[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[()+\-.]/g, "");

  if (!/^\d+$/.test(cleaned)) return null;

  let national;

  // 0098 + 9xxxxxxxxx
  if (cleaned.startsWith("0098")) {
    national = cleaned.slice(4);
  }
  // 98 + 9xxxxxxxxx
  else if (cleaned.startsWith("98")) {
    national = cleaned.slice(2);
  }
  // 0 + 9xxxxxxxxx
  else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    national = cleaned.slice(1);
  }
  // 9xxxxxxxxx
  else {
    national = cleaned;
  }

  // Iranian mobile numbers are 10 digits after removing the leading 0:
  // 9xxxxxxxxx
  if (!/^9\d{9}$/.test(national)) {
    return null;
  }

  return `+98${national}`;
}

/**
 * Validate an Iranian mobile number.
 */
export function isValidIranianMobile(value) {
  return normalizeIranianMobile(value) !== null;
}

/**
 * Convert canonical E.164 Iranian mobile to local format.
 *
 * "+989121234567" → "09121234567"
 *
 * Display only.
 */
export function toLocalMobile(e164) {
  if (typeof e164 === "string" && /^\+989\d{9}$/.test(e164)) {
    return `0${e164.slice(3)}`;
  }

  return e164 ?? "";
}

/**
 * Medical-council number / laboratory license:
 * format is not specified yet, so validation is intentionally lenient.
 *
 * Real authorization / verification happens on the server.
 */
export function isValidLicenseIdentifier(value) {
  return /^[A-Za-z0-9-]{3,20}$/.test(cleanIdentifier(value));
}

/**
 * Normalize a person's full name.
 */
export function normalizeFullName(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u200E\u200F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate a person's full name.
 */
export function isValidFullName(value) {
  const name = normalizeFullName(value);

  if (name.length < 3 || name.length > 80) return false;

  if (!/\p{L}/u.test(name)) return false;

  if (/[\d\u06F0-\u06F9\u0660-\u0669]/.test(name)) {
    return false;
  }

  return true;
}

/**
 * First message per top-level field from a Zod error:
 * { field: message }
 */
export function getFieldErrors(zodError) {
  const errors = {};

  for (const issue of zodError?.issues ?? []) {
    const key = issue.path?.[0];

    if (key !== undefined && errors[key] === undefined) {
      errors[key] = issue.message;
    }
  }

  return errors;
}
