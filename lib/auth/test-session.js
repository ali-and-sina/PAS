import "server-only";

export const TEST_USERS = Object.freeze({
  patient: Object.freeze({
    role: "patient",
    identifier: "1272511677",
    phone: "989120000000",
    full_name: "بیمار تست",
  }),

  doctor: Object.freeze({
    role: "doctor",
    identifier: "12345",
    phone: "989130000000",
    full_name: "پزشک تست",
  }),

  laboratory: Object.freeze({
    role: "laboratory",
    identifier: "LAB-1234",
    phone: "989140000000",
    full_name: "آزمایشگاه تست",
  }),

  admin: Object.freeze({
    role: "admin",
    user_id: process.env.PAS_TEST_ADMIN_USER_ID,
    identifier: "admin",
    phone: "989150000000",
    full_name: "مدیر تست",
  }),
});

/**
 * Demo login may run in a production-mode deployment only when the owner
 * explicitly allows demo access and supplies server-only
 * secrets. Never point such a deployment at real patient information.
 *
 * "NODE_ENV=production" includes Vercel preview/staging builds. This helper
 * is about intentional demo access, not deployment classification alone.
 */
function hasConfiguredSecrets() {
  const accessCode = process.env.PAS_TEST_LOGIN_PASSWORD;
  const authPassword = process.env.PAS_TEST_AUTH_PASSWORD;

  return (
    typeof accessCode === "string" &&
    accessCode.length >= 4 &&
    typeof authPassword === "string" &&
    authPassword.length >= 16 &&
    accessCode !== authPassword
  );
}

function isProductionDemoAllowed() {
  if (process.env.PAS_ALLOW_PRODUCTION_DEMO_LOGIN !== "true") return false;

  const expiry = process.env.PAS_DEMO_LOGIN_EXPIRES_AT;
  // The owner may leave demo access enabled until SMS onboarding is ready.
  // An expiry is optional; when supplied it is still enforced by the server.
  if (!expiry) return true;
  if (
    typeof expiry !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      expiry,
    )
  ) {
    return false;
  }

  const expiryMs = Date.parse(expiry);
  return Number.isFinite(expiryMs) && expiryMs > Date.now();
}

export function isTestLoginEnabled() {
  if (process.env.ENABLE_TEST_LOGIN !== "true" || !hasConfiguredSecrets()) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return isProductionDemoAllowed();
  }

  return process.env.NODE_ENV === "development";
}

export function isAdminTestLoginEnabled() {
  const secret = process.env.PAS_DEMO_ADMIN_LOGIN_PASSWORD;
  const userId = process.env.PAS_TEST_ADMIN_USER_ID;
  return (
    isTestLoginEnabled() &&
    typeof userId === "string" &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) &&
    typeof secret === "string" &&
    secret.length >= 16 &&
    secret !== process.env.PAS_TEST_LOGIN_PASSWORD &&
    secret !== process.env.PAS_TEST_AUTH_PASSWORD
  );
}

export function getTestUserCredentials(identifier, password) {
  if (!isTestLoginEnabled()) return null;
  if (
    typeof identifier !== "string" ||
    identifier.length > 64 ||
    typeof password !== "string" ||
    password.length > 1024
  )
    return null;

  const cleanIdentifier = identifier.trim();
  const testUser = Object.values(TEST_USERS).find(
    (user) => user.identifier === cleanIdentifier,
  );
  if (!testUser) return null;

  if (testUser.role === "admin") {
    if (
      !isAdminTestLoginEnabled() ||
      String(password ?? "") !== process.env.PAS_DEMO_ADMIN_LOGIN_PASSWORD
    ) {
      return null;
    }
  } else if (String(password ?? "") !== process.env.PAS_TEST_LOGIN_PASSWORD) {
    return null;
  }

  return testUser;
}

export function toAuthPhone(phone) {
  const cleanPhone = String(phone ?? "")
    .trim()
    .replace(/^\+/, "");

  return cleanPhone ? `+${cleanPhone}` : "";
}
