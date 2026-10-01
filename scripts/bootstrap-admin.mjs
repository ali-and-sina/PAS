import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path) {
  if (!fs.existsSync(path)) return;

  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    let value = rawValue.trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnv(".env.local");
loadDotEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

const secretKey = process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

if (!url) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
}

if (!secretKey) {
  throw new Error("SUPABASE_SECRET_KEY is required.");
}

/*
 * ---------------------------------------------------------
 * Admin data
 * ---------------------------------------------------------
 */

const phone = process.env.BOOTSTRAP_ADMIN_PHONE ?? "989136914123";

const fullName = process.env.BOOTSTRAP_ADMIN_FULL_NAME ?? "علیرضا علیخانی";

const personnelCode = process.env.BOOTSTRAP_ADMIN_PERSONNEL_CODE ?? "ADM-0001";

/*
 * ---------------------------------------------------------
 * Input validation
 * ---------------------------------------------------------
 */

if (!/^\+989\d{9}$/.test(phone)) {
  throw new Error(
    "BOOTSTRAP_ADMIN_PHONE must be canonical E.164, e.g. +989136914123.",
  );
}

if (!fullName.trim()) {
  throw new Error("BOOTSTRAP_ADMIN_FULL_NAME is required.");
}

if (!personnelCode.trim()) {
  throw new Error("BOOTSTRAP_ADMIN_PERSONNEL_CODE is required.");
}

/*
 * ---------------------------------------------------------
 * Supabase Admin client
 * ---------------------------------------------------------
 */

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let userId = null;

try {
  /*
   * -------------------------------------------------------
   * 1. Create the Auth user through Supabase Auth Admin API
   * -------------------------------------------------------
   *
   * IMPORTANT:
   * Never insert directly into auth.users
   * Never insert directly into auth.identities
   *
   * Supabase Auth must create the real phone identity.
   */

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      phone,
      phone_confirm: true,

      user_metadata: {
        full_name: fullName.trim(),
      },
    });

  if (authError) {
    throw authError;
  }

  if (!authData?.user) {
    throw new Error("Supabase Auth did not return a user.");
  }

  userId = authData.user.id;

  console.log(`Auth user created: ${userId}`);

  /*
   * -------------------------------------------------------
   * 2. Update the profile created by handle_new_user()
   * -------------------------------------------------------
   */

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "admin",
      full_name: fullName.trim(),
      phone,
    })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  console.log("Profile updated to admin.");

  /*
   * -------------------------------------------------------
   * 3. Create admin_profiles row
   * -------------------------------------------------------
   */

  const { error: adminProfileError } = await supabase
    .from("admin_profiles")
    .insert({
      id: userId,
      personnel_code: personnelCode.trim(),
    });

  if (adminProfileError) {
    throw adminProfileError;
  }

  console.log("Admin profile created.");

  /*
   * -------------------------------------------------------
   * 4. Verify Auth user
   * -------------------------------------------------------
   */

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(userId);

  if (userError) {
    throw userError;
  }

  const user = userData?.user;

  if (!user) {
    throw new Error("Created Auth user could not be retrieved.");
  }

  /*
   * Check that a real phone identity exists.
   */

  const hasPhoneIdentity =
    Array.isArray(user.identities) &&
    user.identities.some((identity) => identity.provider === "phone");

  if (!hasPhoneIdentity) {
    throw new Error("Auth user exists, but the phone identity was not found.");
  }

  /*
   * -------------------------------------------------------
   * 5. Verify public.profiles
   * -------------------------------------------------------
   */

  const { data: profile, error: verifyProfileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", userId)
    .single();

  if (verifyProfileError) {
    throw verifyProfileError;
  }

  /*
   * -------------------------------------------------------
   * 6. Verify public.admin_profiles
   * -------------------------------------------------------
   */

  const { data: adminProfile, error: verifyAdminError } = await supabase
    .from("admin_profiles")
    .select("id, personnel_code")
    .eq("id", userId)
    .single();

  if (verifyAdminError) {
    throw verifyAdminError;
  }

  /*
   * -------------------------------------------------------
   * 7. Final integrity verification
   * -------------------------------------------------------
   */

  if (profile.id !== userId) {
    throw new Error("Profile ID verification failed.");
  }

  if (profile.role !== "admin") {
    throw new Error("Profile role verification failed.");
  }

  if (profile.phone !== phone) {
    throw new Error("Profile phone verification failed.");
  }

  if (profile.full_name !== fullName.trim()) {
    throw new Error("Profile full_name verification failed.");
  }

  if (adminProfile.id !== userId) {
    throw new Error("Admin profile ID verification failed.");
  }

  if (adminProfile.personnel_code !== personnelCode.trim()) {
    throw new Error("Personnel code verification failed.");
  }

  /*
   * -------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------
   */

  console.log("");
  console.log("======================================");
  console.log("ADMIN BOOTSTRAP SUCCESS");
  console.log("======================================");

  console.log(
    JSON.stringify(
      {
        ok: true,
        user_id: userId,
        role: profile.role,
        full_name: profile.full_name,
        phone: profile.phone,
        personnel_code: adminProfile.personnel_code,
        phone_identity: true,
      },
      null,
      2,
    ),
  );

  console.log("======================================");
} catch (error) {
  /*
   * -------------------------------------------------------
   * ROLLBACK
   * -------------------------------------------------------
   *
   * If Auth user was created but a later step failed,
   * delete the Auth user so no half-created admin remains.
   */

  if (userId) {
    console.error("Provisioning failed. Rolling back Auth user...");

    const { error: rollbackError } =
      await supabase.auth.admin.deleteUser(userId);

    if (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    } else {
      console.log("Auth user rolled back successfully.");
    }
  }

  console.error("");
  console.error("======================================");
  console.error("ADMIN BOOTSTRAP FAILED");
  console.error("======================================");
  console.error(error);
  console.error("======================================");

  process.exitCode = 1;
}
