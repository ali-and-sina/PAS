import { ROLES, getRoleHome } from "./roles";

export const LOGIN_PATH = "/login";
export const UNAUTHORIZED_PATH = "/unauthorized";
export const PENDING_VERIFICATION_PATH = "/doctor/pending-verification";
export const COMPLETE_PROFILE_PATH = "/patient/complete-profile";

export function getPostLoginRedirect(profile) {
  if (!profile || !profile.role) return LOGIN_PATH;

  if (profile.role === ROLES.DOCTOR && profile.is_verified === false) {
    return PENDING_VERIFICATION_PATH;
  }

  return getRoleHome(profile.role);
}

/**
 * Returns `value` only if it is a safe same-origin path, otherwise null.
 * Blocks protocol-relative ("//host"), backslash tricks, control characters,
 * and paths that would loop back into the auth pages.
 */
export function sanitizeNext(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return null;
  }
  if (!/^\/(?![/\\])[^\s\\\u0000-\u001f]*$/.test(value)) return null;

  const path = value.split(/[?#]/)[0];
  const blocked = [LOGIN_PATH, "/auth"];
  if (blocked.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  return value;
}

function topSegment(path) {
  return path.split(/[/?#]/)[1] ?? "";
}

/**
 * Decides where to go after a successful OTP verification.
 * The server-provided `redirectTo` is authoritative. A caller-supplied `next`
 * is honoured only when it is safe and stays inside the same role area
 * (and never overrides onboarding / pending-verification screens).
 */
export function resolvePostLoginTarget({ redirectTo, next, isNewUser = false } = {}) {
  const target = sanitizeNext(redirectTo);
  if (!target) return "/";

  const isFlowPage =
    isNewUser ||
    target === PENDING_VERIFICATION_PATH ||
    target === COMPLETE_PROFILE_PATH;
  if (isFlowPage) return target;

  const safeNext = sanitizeNext(next);
  if (safeNext && topSegment(safeNext) === topSegment(target)) return safeNext;

  return target;
}
