"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  grantPhysicianVoiceRecordingConsent,
  revokePhysicianVoiceRecordingConsent,
} from "@/features/physician-care/consent-actions";

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function VoiceRecordingConsentCard({ initialGranted = false, grantedAt = null }) {
  const [granted, setGranted] = useState(initialGranted);
  const [consentDate, setConsentDate] = useState(grantedAt);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function changeConsent() {
    setMessage("");
    startTransition(async () => {
      const result = granted
        ? await revokePhysicianVoiceRecordingConsent()
        : await grantPhysicianVoiceRecordingConsent();
      if (!result?.ok) {
        setMessage(result?.message || "تغییر وضعیت رضایت انجام نشد.");
        return;
      }
      const nextGranted = !granted;
      setGranted(nextGranted);
      setConsentDate(nextGranted ? result.data?.granted_at || new Date().toISOString() : null);
      setMessage(nextGranted ? "رضایت شما ثبت شد." : "رضایت شما لغو شد.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {granted ? <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> : <ShieldOff className="size-5 text-muted-foreground" aria-hidden="true" />}
          رضایت برای ضبط یادداشت صوتی ویزیت
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          این رضایت به پزشک تأییدشده اجازه می‌دهد یادداشت صوتی ۳۰ تا ۶۰ ثانیه‌ای مرتبط با ویزیت شما را در پرونده ثبت کند. فایل صوتی خصوصی است و فقط از مسیر مجاز قابل دسترسی خواهد بود. می‌توانید رضایت را هر زمان لغو کنید؛ لغو رضایت مانع ایجاد یادداشت صوتی جدید می‌شود.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs ${granted ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
            {granted ? `رضایت فعال${formatDate(consentDate) ? ` · ${formatDate(consentDate)}` : ""}` : "رضایت ثبت نشده یا لغو شده"}
          </span>
          <Button type="button" variant={granted ? "outline" : "default"} onClick={changeConsent} disabled={pending}>
            {pending ? "در حال ثبت..." : granted ? "لغو رضایت" : "ثبت رضایت"}
          </Button>
        </div>
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
