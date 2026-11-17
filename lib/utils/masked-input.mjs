const DEFAULT_LIMITS = Object.freeze({
  "iranian-mobile": 11,
  "national-id": 10,
  integer: 16,
  money: 16,
});

export function sanitizeMaskedValue(value, mask, maxDigits) {
  const limit = Number.isInteger(maxDigits) && maxDigits > 0
    ? maxDigits
    : DEFAULT_LIMITS[mask] || 32;
  const normalized = String(value ?? "").replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  return normalized.replace(/\D/g, "").slice(0, limit);
}

export function formatMaskedValue(value, mask, maxDigits) {
  const raw = sanitizeMaskedValue(value, mask, maxDigits);
  if (!raw) return "";

  if (mask === "iranian-mobile") {
    if (raw.length === 11 && raw.startsWith("0")) {
      return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
    }
    if (raw.length === 10 && raw.startsWith("9")) {
      return `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
    }
    if (raw.length === 12 && raw.startsWith("98")) {
      return `98 ${raw.slice(2, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`;
    }
    if (raw.length === 14 && raw.startsWith("0098")) {
      return `0098 ${raw.slice(4, 7)} ${raw.slice(7, 10)} ${raw.slice(10)}`;
    }
  }

  if (mask === "national-id" && raw.length === 10) {
    return `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
  }

  if (mask === "money" || mask === "integer") {
    // BigInt avoids rounding large integer amounts during display formatting.
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(BigInt(raw));
  }

  return raw;
}

export function parseMaskedValue(value, mask, maxDigits) {
  return sanitizeMaskedValue(value, mask, maxDigits);
}
