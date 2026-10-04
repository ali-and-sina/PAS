const RANGE = ({ text, min = null, max = null, unit = null, source = "default" }) => ({
  text,
  min,
  max,
  unit,
  source,
});

const DEFAULT_RANGES = {
  WBC: RANGE({ text: "4.5–11.0 ×10⁹/L", min: 4.5, max: 11.0, unit: "×10⁹/L" }),
  HGB: RANGE({ text: "مرد 13.8–17.2 | زن 12.1–15.1 g/dL", unit: "g/dL" }),
  HB: RANGE({ text: "مرد 13.8–17.2 | زن 12.1–15.1 g/dL", unit: "g/dL" }),
  HCT: RANGE({ text: "مرد 37–48 | زن 34–43 %", unit: "%" }),
  RBC: RANGE({ text: "مرد 4.2–5.7 | زن 3.8–5.1 ×10⁶/µL", unit: "×10⁶/µL" }),
  MCV: RANGE({ text: "79–95 fL", min: 79, max: 95, unit: "fL" }),
  MCH: RANGE({ text: "مرد 27–33 | زن 26–33 pg/cell", unit: "pg/cell" }),
  MCHC: RANGE({ text: "32–36 g/dL", min: 32, max: 36, unit: "g/dL" }),
  PLT: RANGE({ text: "150–400 ×10⁹/L", min: 150, max: 400, unit: "×10⁹/L" }),
  PLATELET: RANGE({ text: "150–400 ×10⁹/L", min: 150, max: 400, unit: "×10⁹/L" }),
  GLUCOSE: RANGE({ text: "70–99 mg/dL (ناشتا)", min: 70, max: 99, unit: "mg/dL" }),
  FBS: RANGE({ text: "70–99 mg/dL", min: 70, max: 99, unit: "mg/dL" }),
  SODIUM: RANGE({ text: "135–145 mmol/L", min: 135, max: 145, unit: "mmol/L" }),
  NA: RANGE({ text: "135–145 mmol/L", min: 135, max: 145, unit: "mmol/L" }),
  POTASSIUM: RANGE({ text: "3.7–5.2 mmol/L", min: 3.7, max: 5.2, unit: "mmol/L" }),
  K: RANGE({ text: "3.7–5.2 mmol/L", min: 3.7, max: 5.2, unit: "mmol/L" }),
  CHLORIDE: RANGE({ text: "96–106 mmol/L", min: 96, max: 106, unit: "mmol/L" }),
  CL: RANGE({ text: "96–106 mmol/L", min: 96, max: 106, unit: "mmol/L" }),
  CO2: RANGE({ text: "23–29 mmol/L", min: 23, max: 29, unit: "mmol/L" }),
  HCO3: RANGE({ text: "23–29 mmol/L", min: 23, max: 29, unit: "mmol/L" }),
  BUN: RANGE({ text: "6–20 mg/dL", min: 6, max: 20, unit: "mg/dL" }),
  CREATININE: RANGE({ text: "0.6–1.3 mg/dL", min: 0.6, max: 1.3, unit: "mg/dL" }),
  CR: RANGE({ text: "0.6–1.3 mg/dL", min: 0.6, max: 1.3, unit: "mg/dL" }),
  CALCIUM: RANGE({ text: "8.5–10.2 mg/dL", min: 8.5, max: 10.2, unit: "mg/dL" }),
  CA: RANGE({ text: "8.5–10.2 mg/dL", min: 8.5, max: 10.2, unit: "mg/dL" }),
  ALBUMIN: RANGE({ text: "3.4–5.4 g/dL", min: 3.4, max: 5.4, unit: "g/dL" }),
  ALP: RANGE({ text: "20–130 U/L", min: 20, max: 130, unit: "U/L" }),
  AST: RANGE({ text: "8–33 U/L", min: 8, max: 33, unit: "U/L" }),
  ALT: RANGE({ text: "4–36 U/L", min: 4, max: 36, unit: "U/L" }),
  BILIRUBIN: RANGE({ text: "0.1–1.2 mg/dL", min: 0.1, max: 1.2, unit: "mg/dL" }),
  TPROT: RANGE({ text: "6.0–8.3 g/dL", min: 6.0, max: 8.3, unit: "g/dL" }),
};

function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s._-]+/g, "_");
}

export function resolveReferenceRange(test) {
  if (!test) return null;

  if (test.reference_range) {
    return test.reference_range;
  }

  if (
    test.reference_min != null ||
    test.reference_max != null ||
    test.reference_text
  ) {
    return RANGE({
      text:
        test.reference_text ||
        `${test.reference_min ?? "—"} تا ${test.reference_max ?? "—"}`,
      min: test.reference_min ?? null,
      max: test.reference_max ?? null,
      unit: test.default_unit || null,
      source: "api",
    });
  }

  const candidates = [
    test.internal_code,
    test.loinc_code,
    test.name,
    test.name_fa,
  ]
    .map(normalizeCode)
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = DEFAULT_RANGES[candidate];
    if (exact) return exact;

    for (const [key, range] of Object.entries(DEFAULT_RANGES)) {
      if (candidate === key || candidate.includes(key)) {
        return range;
      }
    }
  }

  return test.default_unit
    ? RANGE({
        text: `طبق رنج مرجع آزمایشگاه (${test.default_unit})`,
        unit: test.default_unit,
        source: "placeholder",
      })
    : RANGE({
        text: "طبق رنج مرجع آزمایشگاه",
        source: "placeholder",
      });
}

export function getDefaultReferenceRanges() {
  return DEFAULT_RANGES;
}
