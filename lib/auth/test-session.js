import "server-only";

export const TEST_USERS = Object.freeze({
  patient: Object.freeze({
    role: "patient",
    user_id:
      process.env.PAS_TEST_PATIENT_USER_ID ||
      "2297e01b-5dd6-4c75-874b-3587f8579a4b",
    identifier: "1272511677",
    phone: "989120000000",
    full_name: "بیمار تست",
  }),

  doctor: Object.freeze({
    role: "doctor",
    user_id:
      process.env.PAS_TEST_DOCTOR_USER_ID ||
      "d636c0cf-705c-40ab-b5d2-e02c25285b39",
    identifier: "12345",
    phone: "989130000000",
    full_name: "پزشک تست",
  }),

  laboratory: Object.freeze({
    role: "laboratory",
    user_id:
      process.env.PAS_TEST_LABORATORY_USER_ID ||
      "6327a661-7e59-4f69-b8e3-e4257ccc5fbf",
    identifier: "LAB-1234",
    phone: "989140000000",
    full_name: "آزمایشگاه تست",
  }),

  admin: Object.freeze({
    role: "admin",
    user_id:
      process.env.PAS_TEST_ADMIN_USER_ID ||
      (process.env.NODE_ENV === "development"
        ? "a05d9a17-0ed4-46d2-a310-c25fec89d04a"
        : undefined),
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

function getAdminTestPassword() {
  return (
    process.env.PAS_DEMO_ADMIN_LOGIN_PASSWORD ||
    (process.env.NODE_ENV === "development" ? "AdminDev-Only-2026!" : "")
  );
}

export function isAdminTestLoginEnabled() {
  const secret = getAdminTestPassword();
  const userId = TEST_USERS.admin.user_id;

  const environmentEnabled =
    process.env.NODE_ENV === "development" ? true : isTestLoginEnabled();

  return (
    environmentEnabled &&
    typeof userId === "string" &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) &&
    secret.length >= 16 &&
    secret !== process.env.PAS_TEST_LOGIN_PASSWORD &&
    secret !== process.env.PAS_TEST_AUTH_PASSWORD
  );
}

export function getTestUserCredentials(identifier, password) {
  const isAdmin =
    typeof identifier === "string" && identifier.trim() === "admin";

  if (isAdmin ? !isAdminTestLoginEnabled() : !isTestLoginEnabled()) {
    return null;
  }
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
      String(password ?? "") !== getAdminTestPassword()
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
