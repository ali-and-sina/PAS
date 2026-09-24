export const ROLES = Object.freeze({
  PATIENT: "patient",
  DOCTOR: "doctor",
  LABORATORY: "laboratory",
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
    case ROLES.ADMIN:
      return "/admin";
    default:
      return "/login";
  }
}
