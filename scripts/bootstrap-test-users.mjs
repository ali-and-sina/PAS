import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
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

const projectRoot = process.cwd();

loadDotEnv(path.join(projectRoot, ".env.local"));

loadDotEnv(path.join(projectRoot, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

const secretKey = process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!secretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PASSWORD = "123456";

const TEST_USERS = [
  {
    key: "patient",
    identifier: "1272647846",
    phone: "989120000000",
    full_name: "بیمار تست",
  },

  {
    key: "doctor",
    identifier: "12345",
    phone: "989130000000",
    full_name: "پزشک تست",
  },

  {
    key: "laboratory",
    identifier: "LAB-1234",
    phone: "989140000000",
    full_name: "آزمایشگاه تست",
  },

  {
    key: "admin",
    identifier: "admin",
    phone: "989150000000",
    full_name: "مدیر تست",
  },
];

function authPhone(phone) {
  return `+${String(phone).replace(/^\+/, "")}`;
}

async function listAllUsers() {
  const users = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    users.push(...(data?.users ?? []));

    if (!data?.users || data.users.length < 1000) {
      break;
    }
  }

  return users;
}

async function ensureAuthUser(spec, users) {
  const phone = authPhone(spec.phone);

  const existing = users.find((user) => String(user.phone ?? "") === phone);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: PASSWORD,
        phone,
        phone_confirm: true,
        user_metadata: {
          full_name: spec.full_name,
        },
      },
    );

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    phone,
    password: PASSWORD,
    phone_confirm: true,
    user_metadata: {
      full_name: spec.full_name,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function provisionProfile(spec, userId) {
  for (const table of [
    "doctor_profiles",
    "laboratory_profiles",
    "patient_profiles",
    "admin_profiles",
  ]) {
    const { error } = await supabase.from(table).delete().eq("id", userId);

    if (error) {
      throw error;
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: spec.key,
      full_name: spec.full_name,
      phone: spec.phone,
      national_id: spec.key === "patient" ? spec.identifier : null,
    })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  if (spec.key === "doctor") {
    const { error } = await supabase.from("doctor_profiles").insert({
      id: userId,
      medical_license_number: spec.identifier,
      specialty: "پزشک عمومی",
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: null,
    });

    if (error) {
      throw error;
    }
  }

  if (spec.key === "laboratory") {
    const { error } = await supabase.from("laboratory_profiles").insert({
      id: userId,
      license_number: spec.identifier,
      organization_id: null,
    });

    if (error) {
      throw error;
    }
  }

  if (spec.key === "patient") {
    const { error } = await supabase.from("patient_profiles").insert({
      id: userId,
      date_of_birth: "1990-01-01",
      sex: "male",
      blood_type: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    });

    if (error) {
      throw error;
    }
  }

  if (spec.key === "admin") {
    const { error } = await supabase.from("admin_profiles").insert({
      id: userId,
      personnel_code: spec.identifier,
    });

    if (error) {
      throw error;
    }
  }
}

const users = await listAllUsers();

for (const spec of TEST_USERS) {
  const user = await ensureAuthUser(spec, users);

  await provisionProfile(spec, user.id);

  console.log(`${spec.key}: ${user.id}`);
}

console.log("Test users provisioned.");

console.log("Password for all test users: 1234");
