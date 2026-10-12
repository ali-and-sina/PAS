"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, MessageSquareText, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createGuestResultAccess } from "@/features/patient/actions";

function normalizeIranianMobile(value) {
  const digits = String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");

  if (digits.startsWith("0098")) return `+${digits.slice(2)}`;
  if (digits.startsWith("98")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+98${digits.slice(1)}`;
  return digits ? `+${digits}` : "";
}

function getOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

export default function GuestResultLinkPanel({ reportId, patientPhone = null }) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  const createLink = () => {
    setMessage("");
    setCopied(false);

    startTransition(async () => {
      try {
        const result = await createGuestResultAccess({ reportId });

        if (!result?.ok || !result.path) {
          setMessage("ساخت لینک نتیجه انجام نشد.");
          return;
        }

        const origin = getOrigin() || window.location.origin;
        const absoluteUrl = new URL(result.path, origin).toString();

        setLink(absoluteUrl);
        setExpiresAt(result.expiresAt || "");
      } catch (error) {
        console.error("[GuestResultLinkPanel]", error);
        setMessage("در ساخت لینک نتیجه خطایی رخ داد.");
      }
    });
  };

  const copyLink = async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("کپی لینک توسط مرورگر انجام نشد. لینک را از کادر انتخاب و کپی کنید.");
    }
  };

  const openSms = () => {
    if (!link) return;

    const phone = normalizeIranianMobile(patientPhone);
    if (!phone) {
      setMessage("شماره موبایل معتبر برای بیمار ثبت نشده است.");
      return;
    }

    const body = [
      "سلام، نتیجه آزمایش شما آماده است.",
      "برای مشاهده نتیجه روی لینک زیر کلیک کنید:",
      link,
      "پاس",
    ].join("\n");

    window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
  };

  const openLink = () => {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-5 text-primary" aria-hidden="true" />
          لینک مشاهده جواب برای بیمار
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          پس از نهایی شدن نتیجه، یک لینک امن و موقت برای مشاهده همین جواب بسازید.
        </p>

        {!link ? (
          <Button type="button" onClick={createLink} disabled={isPending}>
            <Link2 className="size-4" aria-hidden="true" />
            {isPending ? "در حال ساخت لینک…" : "ساخت لینک مشاهده جواب"}
          </Button>
        ) : (
          <>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="break-all text-xs leading-6 text-foreground">{link}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? "کپی شد" : "کپی لینک"}
              </Button>

              <Button type="button" variant="outline" onClick={openLink}>
                <ExternalLink className="size-4" aria-hidden="true" />
                مشاهده لینک
              </Button>

              <Button type="button" onClick={openSms} disabled={!patientPhone}>
                <MessageSquareText className="size-4" aria-hidden="true" />
                ارسال پیامک
              </Button>
            </div>

            <p className="text-xs leading-6 text-muted-foreground">
              ارسال پیامک در این مرحله برنامه پیامک دستگاه را با متن آماده باز می‌کند؛ ارسال مستقیم از سرور به درگاه پیامک هنوز در سامانه فعال نشده است.
            </p>

            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                اعتبار این لینک تا {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt))} است.
              </p>
            ) : null}
          </>
        )}

        {message ? <p className="text-xs leading-6 text-destructive" role="alert">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
