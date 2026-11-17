import { SERVICE_KINDS } from "@/lib/care/constants";
import { CENTER_TYPES } from "@/lib/centers/config";

export default function CenterServiceSummary({ centerType }) {
  const config = CENTER_TYPES[centerType];
  if (!config || !config.service) return null;
  const service = SERVICE_KINDS.find(([kind]) => kind === config.service);

  return (
    <section className="space-y-2 rounded-xl border bg-muted/20 p-4" aria-label="خدمت مرکز">
      <h3 className="text-sm font-semibold">خدمت مرکز</h3>
      <p className="text-sm leading-6">
        {service?.[1] || config.label}
        <span className="ms-2 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">مطابق نوع ثبت‌شدهٔ مرکز</span>
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        در ساختار فعلی، خدمت از نوع مرکز تعیین می‌شود و امکان افزودن چند خدمت مستقل برای این حساب فعال نیست.
      </p>
    </section>
  );
}
