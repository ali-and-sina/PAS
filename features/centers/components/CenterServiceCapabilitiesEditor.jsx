"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SERVICE_KINDS } from "@/lib/care/constants";
import { setMedicalCenterServices } from "@/features/centers/actions";

export default function CenterServiceCapabilitiesEditor({ providerId, capabilities = [] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() =>
    capabilities.filter((item) => item.is_active).map((item) => item.service_kind),
  );
  const [saved, setSaved] = useState(() =>
    capabilities.filter((item) => item.is_active).map((item) => item.service_kind),
  );
  const [feedback, setFeedback] = useState(null);
  const [pending, startTransition] = useTransition();

  function toggle(kind, checked) {
    setSelected((current) => checked
      ? [...current, kind]
      : current.filter((value) => value !== kind));
    setFeedback(null);
  }

  function save() {
    startTransition(async () => {
      const result = await setMedicalCenterServices({ providerId, serviceKinds: selected });
      if (!result?.ok) {
        setFeedback({ ok: false, text: result?.message || "ذخیرهٔ خدمات انجام نشد." });
        return;
      }
      setSaved([...selected]);
      setFeedback({ ok: true, text: result.message || "خدمات مرکز به‌روزرسانی شد." });
      router.refresh();
    });
  }

  const changed = selected.length !== saved.length || selected.some((kind) => !saved.includes(kind));
  const activeLabels = SERVICE_KINDS.filter(([kind]) => selected.includes(kind)).map(([, label]) => label);

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-labelledby={`service-capabilities-${providerId}`}>
      <div className="space-y-1">
        <h3 id={`service-capabilities-${providerId}`} className="text-sm font-semibold">خدمات قابل ارائه</h3>
        <p className="text-xs leading-6 text-muted-foreground">
          نوع مرکز هویت پنل را مشخص می‌کند؛ این فهرست تعیین می‌کند مرکز واقعاً کدام خدمات را می‌پذیرد. فقط خدماتی را فعال کنید که مجوز و امکان ارائهٔ آن‌ها وجود دارد.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SERVICE_KINDS.map(([kind, label]) => (
          <label key={kind} className="flex min-h-11 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <Checkbox
              checked={selected.includes(kind)}
              onCheckedChange={(checked) => toggle(kind, checked === true)}
              disabled={pending}
              aria-label={label}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        خدمات فعال: {activeLabels.length ? activeLabels.join("، ") : "هیچ خدمتی انتخاب نشده است"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={!changed || pending} loading={pending}>
          ذخیرهٔ خدمات مرکز
        </Button>
        {changed ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setSelected([...saved]); setFeedback(null); }}>لغو تغییرات</Button> : null}
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        غیرفعال‌کردن خدمتی که درخواست باز یا در حال انجام دارد، تا تعیین تکلیف آن درخواست‌ها ممکن نیست. سوابق و گزارش‌های نهایی قبلی حذف نمی‌شوند.
      </p>
      {feedback?.text ? (
        <p role={feedback.ok ? "status" : "alert"} className={feedback.ok ? "text-sm text-status-normal" : "text-sm text-destructive"}>
          {feedback.text}
        </p>
      ) : null}
    </section>
  );
}
