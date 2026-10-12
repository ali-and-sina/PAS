import "server-only";

import {
  getPatientTrendTests as getPatientTrendTestsFromPatient,
  getPatientTrend as getPatientTrendFromPatient,
} from "@/features/patient/queries";

export async function getPatientTrendTests() {
  return getPatientTrendTestsFromPatient();
}

export async function getPatientTrend(testDefinitionId) {
  return getPatientTrendFromPatient(testDefinitionId);
}
