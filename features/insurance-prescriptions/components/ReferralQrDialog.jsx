"use client";

import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Check, Copy, QrCode, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmActionButton from "@/components/shared/ConfirmActionButton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  issuePatientReferralQr,
  issueProviderReferralQr,
  revokePatientReferralQr,
  revokeProviderReferralQr,
} from "@/features/insurance-prescriptions/actions";

const ReferralQrImage = dynamic(() => import("./ReferralQrImage"), {
  loading: () => <div className="mx-auto aspect-square w-full max-w-[16.25rem] animate-pulse rounded-xl border bg-muted/30" aria-hidden="true" />,
});

function formatExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ReferralQrDialog({ mode = "provider", type, scope = "center", referralId, referralStatus, filterStatus = null, pageOffset = 0, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(null);
  const tokenInputRef = useRef(null);
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState(false);

  function issue() {
    startTransition(async () => {
      const result = mode === "patient"
        ? await issuePatientReferralQr({ referralId })
        : await issueProviderReferralQr({ scope, type, referralId, referralStatus, filterStatus, pageOffset });
      if (!result?.ok) {
        toast.error(result?.message || "صدور کد پذیرش انجام نشد.");
        return;
      }
      setQr({ token: result.token, expiresAt: result.expiresAt });
      toast.success("کد پذیرش صادر شد.");
    });
  }

  async function copyToken() {
    if (!qr?.token) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(qr.token);
      toast.success("کد پذیرش کپی شد.");
    } catch {
      tokenInputRef.current?.focus();
      tokenInputRef.current?.select();
      toast.message("توکن انتخاب شد؛ آن را کپی کنید.");
    }
  }

  function closeDialog() {
    if (pending || revoking) return;
    setOpen(false);
    setQr(null);
  }

  function handleOpenChange(nextOpen) {
    if (pending || revoking) return;
    setOpen(nextOpen);
    if (!nextOpen) setQr(null);
  }

  async function revoke() {
    if (revoking) return { ok: false, message: "درخواست قبلی هنوز در حال انجام است." };
    setRevoking(true);
    try {
      const result = mode === "patient"
        ? await revokePatientReferralQr({ referralId })
        : await revokeProviderReferralQr({ scope, type, referralId, referralStatus, filterStatus, pageOffset });
      if (!result?.ok) return { ok: false, message: result?.message || "لغو کد انجام نشد." };
      setQr(null);
      toast.success(result.revokedCount ? "کد پذیرش لغو شد." : "کد فعالی برای لغو وجود نداشت.");
      return { ok: true };
    } catch {
      return { ok: false, message: "لغو کد انجام نشد؛ دوباره تلاش کنید." };
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={disabled} onClick={() => setOpen(true)}>
        <QrCode className="size-4" aria-hidden="true" />
        {mode === "patient" ? "نمایش کد پذیرش" : "کد پذیرش"}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{mode === "patient" ? "کد پذیرش خدمت" : "کد پذیرش ارجاع"}</DialogTitle>
            <DialogDescription>{mode === "patient" ? "این کد فقط برای ارجاع همین خدمت صادر می‌شود و مرکز مقصد آن را اسکن می‌کند." : "این کد فقط برای همین ارجاع و همین ارائه‌دهنده صادر می‌شود."}</DialogDescription>
          </DialogHeader>
          {qr ? (
            <div className="space-y-4">
              <ReferralQrImage value={qr.token} />
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">توکن متنی پشتیبان
                <Input ref={tokenInputRef} value={qr.token} readOnly dir="ltr" onFocus={(event) => event.target.select()} className="h-10 select-all font-mono text-xs" aria-label="توکن متنی کد پذیرش" />
              </label>
              <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />اعتبار کد تا {formatExpiry(qr.expiresAt)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">کد خام پس از بستن این پنجره قابل بازیابی نیست. برای دسترسی دوباره باید کد تازه صادر کنید.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={copyToken}>
                  <Copy className="size-4" aria-hidden="true" />کپی توکن
                </Button>
                <ConfirmActionButton
                  variant="destructive"
                  className="min-h-11 flex-1"
                  onConfirm={revoke}
                  destructive
                  confirmTitle="ابطال کد پذیرش"
                  confirmDescription="کد فعلی فوراً باطل می‌شود و اسکن آن دیگر امکان‌پذیر نخواهد بود. این عملیات قابل بازگشت نیست."
                  confirmLabel="ابطال کد"
                  fallbackErrorMessage="لغو کد انجام نشد؛ دوباره تلاش کنید."
                >
                  <XCircle className="size-4" aria-hidden="true" />لغو کد
                </ConfirmActionButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><QrCode className="size-6" aria-hidden="true" /></span>
              <p className="text-sm font-medium">صدور کد پذیرش برای این ارجاع</p>
              <p className="text-xs leading-5 text-muted-foreground">{mode === "patient" ? "کد تا ۱۵ دقیقه معتبر است. با صدور کد تازه، کد قبلی همین ارجاع باطل می‌شود." : "کد تازه تا ۲۴ ساعت معتبر است. با صدور آن، هر کد فعال قبلی همین ارجاع باطل می‌شود."}</p>
              <Button type="button" onClick={issue} loading={pending} disabled={pending} className="min-h-11">
                <Check className="size-4" aria-hidden="true" />
                صدور یا تازه‌سازی کد
              </Button>
              <div className="border-t pt-3">
                <ConfirmActionButton
                  variant="ghost"
                  className="min-h-11 text-destructive hover:text-destructive"
                  onConfirm={revoke}
                  destructive
                  confirmTitle="ابطال کدهای فعال"
                  confirmDescription="تمام کدهای فعال این ارجاع باطل می‌شوند و دیگر قابل اسکن نیستند."
                  confirmLabel="ابطال کدها"
                  fallbackErrorMessage="ابطال کدهای فعال انجام نشد."
                >
                  <XCircle className="size-4" aria-hidden="true" />ابطال کدهای فعال
                </ConfirmActionButton>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={pending || revoking}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
