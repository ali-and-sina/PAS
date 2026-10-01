import { cookies } from "next/headers";

export const TEST_AUTH_COOKIE = "pezeshkyar_test_auth";

export const TEST_USERS = Object.freeze({
  patient: Object.freeze({
    id: "11111111-1111-4111-8111-111111111111",
    role: "patient",
    full_name: "بیمار تست",
    phone: "989120000000",
    avatar_url: null,
    is_verified: null,
    specialty: null,
    organization_id: null,
    patient_profile_completed: true,
    identifier: "1272511677",
  }),

  doctor: Object.freeze({
    id: "22222222-2222-4222-8222-222222222222",
    role: "doctor",
    full_name: "پزشک تست",
    phone: "989130000000",
    avatar_url: null,
    is_verified: true,
    specialty: "پزشک عمومی",
    organization_id: null,
    patient_profile_completed: null,
    identifier: "12345",
  }),

  laboratory: Object.freeze({
    id: "33333333-3333-4333-8333-333333333333",
    role: "laboratory",
    full_name: "آزمایشگاه تست",
    phone: "989140000000",
    avatar_url: null,
    is_verified: null,
    specialty: null,
    organization_id: "44444444-4444-4444-8444-444444444444",
    patient_profile_completed: null,
    identifier: "LAB-1234",
  }),

  admin: Object.freeze({
    id: "55555555-5555-4555-8555-555555555555",
    role: "admin",
    full_name: "مدیر تست",
    phone: "989150000000",
    avatar_url: null,
    is_verified: null,
    specialty: null,
    organization_id: null,
    patient_profile_completed: null,
    identifier: "admin",
  }),
});

const TEST_PASSWORD = "1234";

export function isTestLoginEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function getTestUserCredentials(identifier, password) {
  if (!isTestLoginEnabled()) {
    return null;
  }

  if (password !== TEST_PASSWORD) {
    return null;
  }

  const cleanIdentifier = String(identifier ?? "").trim();

  return (
    Object.values(TEST_USERS).find(
      (user) => user.identifier === cleanIdentifier,
    ) ?? null
  );
}

export async function setTestAuthCookie(role) {
  if (!isTestLoginEnabled()) {
    return false;
  }

  const user = TEST_USERS[role];

  if (!user) {
    return false;
  }

  const cookieStore = await cookies();

  cookieStore.set(TEST_AUTH_COOKIE, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return true;
}

export async function clearTestAuthCookie() {
  const cookieStore = await cookies();

  cookieStore.set(TEST_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getTestSessionUser() {
  if (!isTestLoginEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const role = cookieStore.get(TEST_AUTH_COOKIE)?.value;

  if (!role) {
    return null;
  }

  return TEST_USERS[role] ?? null;
}
