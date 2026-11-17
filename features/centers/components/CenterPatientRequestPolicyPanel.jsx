"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getCenterPatientRequestPolicies,
  setCenterPatientRequestPolicy,
} from "@/features/care/actions";
import { SERVICE_KINDS } from "@/lib/care/constants";

export default function CenterPatientRequestPolicyPanel({ serviceKind, centerLabel, initialEnabled }) {
  const hasInitialValue = typeof initialEnabled === "boolean";
  const [enabled, setEnabled] = useState(initialEnabled === true);
  const [loaded, setLoaded] = useState(hasInitialValue);
  const [loading, setLoading] = useState(!hasInitialValue);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);

  const serviceLabel = useMemo(
    () => SERVICE_KINDS.find(([kind]) => kind === serviceKind)?.[1] || "این خدمت",
    [serviceKind],
  );

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    const result = await getCenterPatientRequestPolicies();
    if (result?.ok) {
      const current = result.items.find((item) => item.service_kind === serviceKind);
      setEnabled(current?.patient_requests_enabled === true);
      setLoaded(true);
      setMessage(null);
    } else {
      setLoaded(false);
      setMessage({
        ok: false,
        text: result?.message || "وضعیت پذیرش مستقیم دریافت نشد.",
      });
    }
    setLoading(false);
  }, [serviceKind]);

  useEffect(() => {
    if (hasInitialValue) {
      setEnabled(initialEnabled);
      setLoaded(true);
      setLoading(false);
      setMessage(null);
      return undefined;
    }

    let active = true;
    (async () => {
      setLoading(true);
      const result = await getCenterPatientRequestPolicies();
      if (!active) return;
      if (result?.ok) {
        const current = result.items.find((item) => item.service_kind === serviceKind);
        setEnabled(current?.patient_requests_enabled === true);
        setLoaded(true);
        setMessage(null);
      } else {
        setLoaded(false);
        setMessage({ ok: false, text: result?.message || "وضعیت پذیرش مستقیم دریافت نشد." });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [serviceKind, hasInitialValue, initialEnabled]);

  async function updatePolicy(nextEnabled) {
    if (pending || nextEnabled === enabled && loaded) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await setCenterPatientRequestPolicy({ serviceKind, enabled: nextEnabled });
      if (!result?.ok) {
        setMessage({ ok: false, text: result?.message || "تغییر وضعیت انجام نشد." });
        return;
      }
      setEnabled(nextEnabled);
      setLoaded(true);
      setMessage({ ok: true, text: result.message || "وضعیت پذیرش به‌روزرسانی شد." });
    } catch {
      setMessage({ ok: false, text: "ارتباط با تنظیمات مرکز برقرار نشد." });
    } finally {
      setPending(false);
    }
  }

  if (!serviceKind) return null;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby={`patient-request-policy-title-${serviceKind}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`patient-request-policy-title-${serviceKind}`} className="font-semibold">پذیرش مستقیم {serviceLabel}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            مشخص کنید بیماران بتوانند برای {centerLabel || "مرکز"}، خدمت {serviceLabel} را مستقیماً درخواست کنند یا خیر.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${loaded && enabled ? "bg-status-normal-bg text-status-normal" : "bg-muted text-muted-foreground"}`}>
          {loading ? "در حال دریافت وضعیت" : loaded ? (enabled ? "پذیرش مستقیم فعال" : "پذیرش مستقیم غیرفعال") : "وضعیت نامشخص"}
        </span>
      </div>

      <p className="rounded-xl bg-muted/35 p-3 text-xs leading-6 text-muted-foreground">
        فعال‌سازی این گزینه فقط اجازهٔ ثبت درخواست مستقیم را می‌دهد؛ زمان انتخابی بیمار نوبت قطعی نیست. مرکز پس از بررسی درخواست باید زمان نهایی را جداگانه تأیید کند.
      </p>

      {!loaded && !loading ? (
        <div className="space-y-2 rounded-xl border border-dashed p-3">
          <p className="text-xs leading-6 text-muted-foreground">
            وضعیت فعلی پذیرش مستقیم دریافت نشد. برای جلوگیری از نمایش وضعیت اشتباه، ابتدا وضعیت را دوباره دریافت کنید.
          </p>
          <Button type="button" size="sm" variant="outline" disabled={pending} loading={pending} onClick={() => updatePolicy(true)}>
            فعال‌سازی پذیرش مستقیم
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={loading || pending || enabled} loading={pending && enabled} onClick={() => updatePolicy(true)}>
            فعال‌سازی پذیرش مستقیم
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={loading || pending || !enabled} loading={pending && !enabled} onClick={() => updatePolicy(false)}>
            غیرفعال‌سازی پذیرش مستقیم
          </Button>
          {!loading && loaded && !enabled ? (
            <span className="self-center text-xs text-muted-foreground">درخواست مستقیم بیمار فعلاً برای این خدمت پذیرفته نمی‌شود.</span>
          ) : null}
        </div>
      )}

      {message?.text ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-status-normal" : "text-sm text-destructive"}>
          {message.text}
        </p>
      ) : null}

      {!loaded && !loading ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={loadPolicies}>
          تلاش دوباره برای دریافت وضعیت
        </Button>
      ) : null}
    </section>
  );
}
