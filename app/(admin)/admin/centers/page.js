import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { getAdminCenters } from "@/features/centers/queries";
import { CENTER_TYPE_OPTIONS } from "@/lib/centers/config";
import AdminCentersList from "@/features/centers/components/AdminCentersList";
export const metadata = { title: "مراکز درمانی" };
export const dynamic = "force-dynamic";
export default async function CentersPage({ searchParams }) {
  const { type } = await searchParams;
  const centers = await getAdminCenters(type);
  // Keep the client-side filter payload limited to fields rendered in this panel.
  const visibleCenters = centers.map((center) => {
    const rawLabProfile = Array.isArray(center.laboratory_profiles)
      ? center.laboratory_profiles[0]
      : center.laboratory_profiles;
    const rawProfile = Array.isArray(rawLabProfile?.profiles)
      ? rawLabProfile.profiles[0]
      : rawLabProfile?.profiles;
    return {
      profile_id: center.profile_id,
      display_name: center.display_name,
      center_type: center.center_type,
      is_active: center.is_active,
      laboratory_profile: rawLabProfile ? {
        license_number: rawLabProfile.license_number || null,
        profile: rawProfile ? {
          full_name: rawProfile.full_name || null,
          phone: rawProfile.phone || null,
        } : null,
      } : null,
    };
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="مراکز درمانی"
        description="نوع مرکز، پنل اختصاصی و وضعیت دسترسی هر حساب را مدیریت کنید."
        actions={
          <Button asChild>
            <Link href="/admin/centers/new">ایجاد مرکز درمانی</Link>
          </Button>
        }
      />
      <form className="flex flex-wrap items-end gap-3">
        <label className="space-y-2 text-sm">
          <span className="block">نوع مرکز</span>
          <select
            name="type"
            defaultValue={type || ""}
            className="min-h-11 rounded-xl border bg-card px-3"
          >
            <option value="">همهٔ مراکز</option>
            {CENTER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant="outline" type="submit">
          نمایش مراکز
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/admin/laboratories/branches">
            مدیریت شعب آزمایشگاه‌ها
          </Link>
        </Button>
      </form>
      <AdminCentersList centers={visibleCenters} />
    </div>
  );
}
