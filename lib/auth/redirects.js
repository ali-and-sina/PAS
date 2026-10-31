import { centerHome } from "../centers/config";
import { ROLES, getRoleHome } from "./roles";

export const LOGIN_PATH = "/login";
export const UNAUTHORIZED_PATH = "/unauthorized";
export const PENDING_VERIFICATION_PATH = "/doctor/pending-verification";
export const COMPLETE_PROFILE_PATH = "/patient/complete-profile";

export function getPostLoginRedirect(profile) {
  if (!profile || !profile.role) {
    return LOGIN_PATH;
  }

  if (profile.role === ROLES.DOCTOR && profile.is_verified === false) {
    return PENDING_VERIFICATION_PATH;
  }

  if (
    profile.role === ROLES.PATIENT &&
    profile.patient_profile_completed === false
  ) {
    return COMPLETE_PROFILE_PATH;
  }

  if ([ROLES.LABORATORY, ROLES.MEDICAL_CENTER].includes(profile.role)) {
    return profile.center_active === true ? centerHome(profile.center_type) : "/center/unavailable";
  }
  return getRoleHome(profile.role);
}

/**
 * Returns value only when it is a safe same-origin path.
 */
export function sanitizeNext(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return null;
  }

  if (!/^\/(?![/\\])[^\s\\\u0000-\u001f]*$/.test(value)) {
    return null;
  }

  const path = value.split(/[?#]/)[0];

  const blocked = [LOGIN_PATH, "/auth"];

  if (
    blocked.some(
      (blockedPath) =>
        path === blockedPath || path.startsWith(`${blockedPath}/`),
    )
  ) {
    return null;
  }

  return value;
}

function topSegment(path) {
  return path.split(/[/?#]/)[1] ?? "";
}

export function resolvePostLoginTarget({
  redirectTo,
  next,
  isNewUser = false,
} = {}) {
  const target = sanitizeNext(redirectTo);

  if (!target) {
    return "/";
  }

  const isFlowPage =
    isNewUser ||
    target === PENDING_VERIFICATION_PATH ||
    target === COMPLETE_PROFILE_PATH;

  if (isFlowPage) {
    return target;
  }

  const safeNext = sanitizeNext(next);

  if (safeNext && topSegment(safeNext) === topSegment(target)) {
    return safeNext;
  }

  return target;
}
