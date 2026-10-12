export function getTestDisplayName(test) {
  if (typeof test === "string") {
    return test.trim() || "آزمایش";
  }

  const localized = typeof test?.name_fa === "string" ? test.name_fa.trim() : "";
  if (localized) return localized;

  const canonical = typeof test?.name === "string" ? test.name.trim() : "";
  if (canonical) return canonical;

  const code = typeof test?.internal_code === "string" ? test.internal_code.trim() : "";
  return code || "آزمایش";
}
