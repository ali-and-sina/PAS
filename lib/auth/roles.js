export const ROLES = Object.freeze({
  PATIENT: "patient",
  DOCTOR: "doctor",
  LABORATORY: "laboratory",
  MEDICAL_CENTER: "medical_center",
  ADMIN: "admin",
});

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

export function getRoleHome(role) {
  switch (role) {
    case ROLES.PATIENT:
      return "/patient/dashboard";
    case ROLES.DOCTOR:
      return "/doctor/dashboard";
    case ROLES.LABORATORY:
      return "/lab/dashboard";
    case ROLES.MEDICAL_CENTER:
      return "/center";
    case ROLES.ADMIN:
      return "/admin";
    default:
      return "/login";
  }
}
