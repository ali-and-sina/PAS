import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

function parseOptionalCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

/**
 * Search the public-safe branch directory through a narrow RPC. The database
 * normalizes Arabic/Persian ی and ک variants and can calculate approximate
 * distance without persisting the patient's current location.
 */
export async function searchLaboratoryBranches({
  query = "",
  city = "",
  latitude = null,
  longitude = null,
  limit = 20,
} = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") return [];

  const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== "";
  const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== "";
  if (hasLatitude !== hasLongitude) return [];
  const lat = parseOptionalCoordinate(latitude, -90, 90);
  const lon = parseOptionalCoordinate(longitude, -180, 180);
  if (hasLatitude && (lat === null || lon === null)) return [];
  const hasPair = lat !== null && lon !== null;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_laboratory_branches", {
    p_query: String(query || "").trim().slice(0, 120) || null,
    p_city: String(city || "").trim().slice(0, 120) || null,
    p_latitude: hasPair ? lat : null,
    p_longitude: hasPair ? lon : null,
    p_limit: Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20)),
  });

  if (error) {
    console.error("[searchLaboratoryBranches]", error);
    throw new Error("جست‌وجوی آزمایشگاه‌ها انجام نشد.");
  }

  return (data || []).map((row) => ({
    ...row,
    name: row.display_name || row.organization_name || "آزمایشگاه",
    distance_km: row.distance_km == null
      ? null
      : Number.isFinite(Number(row.distance_km))
        ? Number(row.distance_km)
        : null,
  }));
}
