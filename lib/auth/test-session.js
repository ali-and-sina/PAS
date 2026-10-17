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
    identifier: "admin",
    phone: "989150000000",
    full_name: "مدیر تست",
  }),
});

export const TEST_PASSWORD = "1234";

export const TEST_AUTH_PASSWORD = "123456";

/**
 * Test login is available automatically during local development.
 * In production it is enabled only by an explicit Vercel environment flag.
 */
export function isTestLoginEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return process.env.ENABLE_TEST_LOGIN === "true";
}

export function getTestUserCredentials(identifier, password) {
  if (!isTestLoginEnabled()) {
    return null;
  }

  if (String(password ?? "") !== TEST_PASSWORD) {
    return null;
  }

  const cleanIdentifier = String(identifier ?? "").trim();

  return (
    Object.values(TEST_USERS).find(
      (user) => user.identifier === cleanIdentifier,
    ) ?? null
  );
}

export function toAuthPhone(phone) {
  const cleanPhone = String(phone ?? "")
    .trim()
    .replace(/^\+/, "");

  return cleanPhone ? `+${cleanPhone}` : "";
}
