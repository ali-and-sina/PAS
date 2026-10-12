import "server-only";

import { getTestDisplayName } from "@/lib/medical/test-name";

const RANGE_SELECT =
  "id, test_definition_id, laboratory_id, sex, min_age_years, max_age_years, min_value, max_value, unit, method, is_active";

function calculateAgeYears(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;

  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;

  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function matchesAge(range, age) {
  if (age == null) {
    return range.min_age_years == null && range.max_age_years == null;
  }

  if (
    range.min_age_years != null &&
    age < Number(range.min_age_years)
  ) {
    return false;
  }

  if (
    range.max_age_years != null &&
    age > Number(range.max_age_years)
  ) {
    return false;
  }

  return true;
}

function matchesSex(range, sex) {
  const rule = String(range.sex || "any").toLowerCase();

  return rule === "any" || !sex || rule === String(sex).toLowerCase();
}

function specificityScore(range, laboratoryId, sex) {
  const labSpecific = range.laboratory_id === laboratoryId ? 1000 : 0;
  const sexSpecific =
    String(range.sex || "any").toLowerCase() !== "any" &&
    sex &&
    String(range.sex).toLowerCase() === String(sex).toLowerCase()
      ? 100
      : 0;

  const boundedAge =
    (range.min_age_years != null ? 10 : 0) +
    (range.max_age_years != null ? 10 : 0);

  const minAge =
    range.min_age_years == null ? Number.POSITIVE_INFINITY : Number(range.min_age_years);
  const maxAge =
    range.max_age_years == null ? Number.POSITIVE_INFINITY : Number(range.max_age_years);
  const span =
    Number.isFinite(minAge) && Number.isFinite(maxAge)
      ? Math.max(0, maxAge - minAge)
      : Number.POSITIVE_INFINITY;

  return {
    labSpecific,
    sexSpecific,
    boundedAge,
    span,
  };
}

async function getPatientDemographics(admin, patientId) {
  const { data, error } = await admin
    .from("patient_profiles")
    .select("date_of_birth, sex")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function resolveReferenceRanges({
  admin,
  laboratoryId,
  patientId,
  testDefinitionIds,
}) {
  const ids = [...new Set((testDefinitionIds || []).filter(Boolean))];

  if (!admin || !laboratoryId || !patientId || !ids.length) {
    return new Map();
  }

  const demographics = await getPatientDemographics(admin, patientId);
  const age = calculateAgeYears(demographics?.date_of_birth || null);
  const sex = demographics?.sex || null;

  const { data: rows, error } = await admin
    .from("reference_range_templates")
    .select(RANGE_SELECT)
    .in("test_definition_id", ids)
    .eq("is_active", true);

  if (error) throw error;

  const result = new Map();

  for (const testId of ids) {
    const candidates = (rows || []).filter((range) => {
      if (range.test_definition_id !== testId) return false;

      if (
        range.laboratory_id !== laboratoryId &&
        range.laboratory_id !== null
      ) {
        return false;
      }

      return matchesSex(range, sex) && matchesAge(range, age);
    });

    candidates.sort((a, b) => {
      const aScore = specificityScore(a, laboratoryId, sex);
      const bScore = specificityScore(b, laboratoryId, sex);

      if (aScore.labSpecific !== bScore.labSpecific) {
        return bScore.labSpecific - aScore.labSpecific;
      }

      if (aScore.sexSpecific !== bScore.sexSpecific) {
        return bScore.sexSpecific - aScore.sexSpecific;
      }

      if (aScore.boundedAge !== bScore.boundedAge) {
        return bScore.boundedAge - aScore.boundedAge;
      }

      if (aScore.span !== bScore.span) {
        return aScore.span - bScore.span;
      }

      return String(a.id).localeCompare(String(b.id));
    });

    if (candidates[0]) {
      result.set(testId, candidates[0]);
    }
  }

  return result;
}

export function buildReferenceSnapshot(test, range) {
  if (!range) {
    return {
      reference_range_template_id: null,
      reference_min: null,
      reference_max: null,
      reference_text: null,
      unit: test.default_unit || "",
      reference_source: null,
    };
  }

  const testUnit = String(test.default_unit || "");
  const rangeUnit = String(range.unit || "");

  if (testUnit && rangeUnit && testUnit !== rangeUnit) {
    return {
      ok: false,
      message:
        `واحد محدوده مرجع آزمایش «${getTestDisplayName(test)}» با واحد تعریف‌شده تست سازگار نیست.`,
    };
  }

  let referenceText = null;

  if (range.min_value != null && range.max_value != null) {
    referenceText = `${range.min_value} – ${range.max_value}`;
  } else if (range.min_value != null) {
    referenceText = `≥ ${range.min_value}`;
  } else if (range.max_value != null) {
    referenceText = `≤ ${range.max_value}`;
  }

  return {
    ok: true,
    reference_range_template_id: range.id,
    reference_min: range.min_value ?? null,
    reference_max: range.max_value ?? null,
    reference_text: referenceText,
    unit: testUnit || rangeUnit,
    reference_source:
      range.laboratory_id === null ? "generic" : "laboratory",
  };
}

export function calculateNumericFlag(value, reference) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return "normal";

  if (
    reference?.reference_min != null &&
    numeric < Number(reference.reference_min)
  ) {
    return "low";
  }

  if (
    reference?.reference_max != null &&
    numeric > Number(reference.reference_max)
  ) {
    return "high";
  }

  return "normal";
}
