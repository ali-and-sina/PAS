import "server-only";

import { getSessionUser } from "@/lib/auth/server";

export async function requireVerifiedDoctor() {
  const user = await getSessionUser();

  if (!user || user.role !== "doctor" || user.is_verified !== true) {
    return null;
  }

  return user;
}
