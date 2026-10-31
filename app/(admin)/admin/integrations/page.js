import PageHeader from "@/components/shared/PageHeader";
import { CommandButton } from "@/components/care/ActionControls";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { BRIDGE_PROVIDERS } from "@/lib/integrations/bridge";
export const dynamic = "force-dynamic";
export const metadata = { title: "اتصال سامانه‌ها" };
export default async function IntegrationsPage() {
  await requireAdmin();
  const db = await createClient();
  const { data, error } = await db.from("pas_integration_connections").select("*").order("provider_key");
  if (error) throw error;
  return <div className="space-y-6"><PageHeader title="اتصال سامانه‌های بیرونی" description="کنترل دریافت اطلاعات از اتصال‌های تأییدشده و نگهداری منبع هر سابقه." /><p className="rounded-xl border bg-card p-5 text-sm leading-8">اتصال عملیاتی هر سامانه پس از دریافت مستندات رسمی، دسترسی و پیاده‌سازی مبدل همان ارائه‌دهنده فعال می‌شود. دریافت نسخه و گزارش، بسته به اطلاعاتی است که آن سرویس ارائه می‌دهد.</p><div className="grid gap-4 md:grid-cols-2">{(data || []).map((provider) => {
    const configured = Boolean(process.env[BRIDGE_PROVIDERS[provider.provider_key]]?.length >= 32);
    return <section key={provider.provider_key} className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{provider.display_name}</h2><p className="text-sm text-muted-foreground">{!configured ? "در انتظار تنظیم دسترسی اتصال" : provider.enabled ? "دریافت از واسط تنظیم‌شده فعال است" : "دسترسی واسط تنظیم شده؛ دریافت غیرفعال است"}</p><CommandButton action="integration.configure" payload={{ provider_key: provider.provider_key, enabled: !provider.enabled }} disabled={!configured && !provider.enabled}>{provider.enabled ? "توقف دریافت" : "فعال‌سازی دریافت از واسط"}</CommandButton></section>;
  })}</div></div>;
}
