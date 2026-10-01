"use server";

import { getPostLoginRedirect } from "@/lib/auth";
import {
  getTestUserCredentials,
  setTestAuthCookie,
  clearTestAuthCookie,
} from "@/lib/auth/test-session";

export async function loginTestUser({ identifier, password } = {}) {
  const user = getTestUserCredentials(identifier, password);

  if (!user) {
    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  const saved = await setTestAuthCookie(user.role);

  if (!saved) {
    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }

  return {
    ok: true,
    role: user.role,
    redirectTo: getPostLoginRedirect(user),
  };
}

export async function logoutTestUser() {
  await clearTestAuthCookie();

  return {
    ok: true,
  };
}
