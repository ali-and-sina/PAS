"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { CENTER_TYPES } from "@/lib/centers/config";
import { setCenterPatientRequestPolicy } from "@/features/centers/actions";

const SERVICE_LABELS = Object.freeze({
  ct: "سی‌تی‌اسکن",
  mri: "ام‌آر‌آی",
  ecg: "نوار قلب",
  ultrasound: "سونوگرافی",
  mammography: "ماموگرافی",
  xray: "رادیوگرافی",
  physiotherapy: "فیزیوتراپی",
  other: "سایر خدمات پزشکی",
});

export default function CenterRequestPolicySettings({ centerType, items = [] }) {
  const [enabledByService, setEnabledByService] = useState(() =>
    Object.fromEntries(items.map((item) => [item.service_kind, Boolean(item.patient_requests_enabled)])),
  );
  const [feedback, setFeedback] = useState(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const center = CENTER_TYPES[centerType];
  const serviceKind = center?.service;

  if (!serviceKind || !SERVICE_LABELS[serviceKind]) return null;

  async function update(enabled) {
    const previous = Boolean(enabledByService[serviceKind]);
    setFeedback(null);
    setEnabledByService((current) => ({ ...current, [serviceKind]: enabled }));
    startTransition(async () => {
      try {
        const result = await setCenterPatientRequestPolicy({ centerType, serviceKind, enabled });
        if (!result?.ok) {
          setEnabledByService((current) => ({ ...current, [serviceKind]: previous }));
          setFeedback({ ok: false, message: result?.message || "تنظیم ذخیره نشد." });
          return;
        }
        setFeedback({ ok: true, message: result.message });
        router.refresh();
      } catch {
        setEnabledByService((current) => ({ ...current, [serviceKind]: previous }));
        setFeedback({ ok: false, message: "ارتباط برقرار نشد؛ تنظیم ذخیره نشد." });
      }
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">پذیرش درخواست مستقیم بیمار</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">در صورت فعال‌سازی، بیمار می‌تواند بدون ارجاع پزشک برای خدمت این مرکز درخواست ثبت کند. فعال‌سازی، نوبت را رزرو نمی‌کند؛ مرکز پس از بررسی درخواست زمان مراجعه را تأیید می‌کند.</p>
      </div>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border p-3">
        <Checkbox
          checked={Boolean(enabledByService[serviceKind])}
          onCheckedChange={(checked) => update(checked === true)}
          disabled={pending}
          aria-label={`پذیرش درخواست مستقیم ${SERVICE_LABELS[serviceKind]}`}
        />
        <span className="text-sm font-medium">پذیرش درخواست مستقیم {SERVICE_LABELS[serviceKind]}</span>
      </label>
      {feedback ? <p role={feedback.ok ? "status" : "alert"} className={`text-sm leading-6 ${feedback.ok ? "text-emerald-700" : "text-destructive"}`}>{feedback.message}</p> : null}
      {pending ? <p className="text-xs text-muted-foreground">در حال ذخیرهٔ تنظیم…</p> : null}
    </section>
  );
}
