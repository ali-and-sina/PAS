import "server-only";

import { getSessionUser } from "@/lib/auth/server";

/**
 * Resolve patient identity from the authenticated server session only.
 * No caller-supplied patient id is accepted by this authorization layer.
 */
export async function getPatientContext() {
  const user = await getSessionUser();

  if (
    !user ||
    user.role !== "patient" ||
    user.patient_profile_completed !== true ||
    !user.id
  ) {
    return null;
  }

  return {
    ...user,
    patient_id: user.id,
  };
}

/** Throw rather than silently using an arbitrary patient id in protected work. */
export async function requirePatient() {
  const patient = await getPatientContext();
  if (!patient) {
    throw new Error("PATIENT_ACCESS_DENIED");
  }
  return patient;
}
