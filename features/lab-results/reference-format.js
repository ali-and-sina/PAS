export function formatReferenceRange(observation) {
  if (!observation) return null;

  const text = String(observation.reference_text || "").trim();
  if (text) return text;

  const min = observation.reference_min;
  const max = observation.reference_max;

  if (min != null && max != null) {
    return `${min} تا ${max}`;
  }

  if (min != null) {
    return `حداقل ${min}`;
  }

  if (max != null) {
    return `حداکثر ${max}`;
  }

  return null;
}

export function getReferenceSourceLabel(source) {
  if (source === "laboratory") return "محدوده آزمایشگاه";
  if (source === "generic") return "محدوده عمومی";
  return null;
}
