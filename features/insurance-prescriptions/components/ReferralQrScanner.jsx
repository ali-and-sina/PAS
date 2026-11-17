"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import { resolveProviderReferralQr } from "@/features/insurance-prescriptions/actions";

const PAYER_LABELS = { tamin: "تأمین اجتماعی", ihio: "بیمه سلامت", armed_forces: "نیروهای مسلح" };
const ITEM_KIND_LABELS = { laboratory: "آزمایش", imaging: "تصویربرداری", medication: "دارو", medical_service: "خدمت پزشکی", other: "خدمت دیگر" };
const STATUS_LABELS = {
  assigned: "ارجاع‌شده",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  partially_completed: "تکمیل بخشی از اقلام",
  completed: "خدمت انجام‌شده",
  result_submitted: "نتیجه ارسال‌شده",
  finalized: "نهایی‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ReferralQrScanner({ type, scope = "center" }) {
  const videoRef = useRef(null);
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCameraSupported(
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  useEffect(() => {
    if (!scanning || !videoRef.current) return undefined;

    let active = true;
    let stream = null;
    let animationFrame = 0;
    let detector = null;

    async function startCamera() {
      try {
        if (!cameraSupported) throw new Error("CAMERA_UNAVAILABLE");
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });
        if (!active || !videoRef.current) {
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const scanFrame = async () => {
          if (!active || !videoRef.current || !detector) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.find((code) => code.rawValue)?.rawValue;
            if (value) {
              setToken(value);
              setScanning(false);
              stopCamera();
              return;
            }
          } catch {
            // A frame may be unavailable while the camera is focusing.
          }
          animationFrame = window.requestAnimationFrame(scanFrame);
        };
        animationFrame = window.requestAnimationFrame(scanFrame);
      } catch (error) {
        setScanning(false);
        if (error?.message === "CAMERA_UNAVAILABLE") {
          toast.error("اسکن مستقیم در این مرورگر پشتیبانی نمی‌شود. توکن را دستی وارد کنید.");
        } else {
          toast.error("دسترسی به دوربین ممکن نشد. اجازه دسترسی را بررسی کنید.");
        }
      }
    }

    function stopCamera() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [scanning, cameraSupported]);

  function resolve(event) {
    event.preventDefault();
    startTransition(async () => {
      const response = await resolveProviderReferralQr({ scope, type, token: token.trim() });
      if (!response?.ok) {
        setResult(null);
        toast.error(response?.message || "کد پذیرش معتبر نیست یا به این مرکز تعلق ندارد.");
        return;
      }
      setResult(response.data);
      setToken("");
      toast.success("ارجاع با موفقیت شناسایی شد.");
    });
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-5">
        <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Camera className="size-4" aria-hidden="true" /></span><div><CardTitle>پذیرش با کد QR</CardTitle><p className="mt-1 text-xs text-muted-foreground">کد مخصوص ارجاع همین ارائه‌دهنده را اسکن کنید.</p></div></div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {cameraSupported ? (
          <div className="space-y-2">
            {scanning ? <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label="نمای دوربین برای اسکن کد" /> : null}
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => { setResult(null); setScanning((value) => !value); }}>
              {scanning ? <CameraOff className="size-4" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
              {scanning ? "توقف دوربین" : "شروع اسکن با دوربین"}
            </Button>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">اسکن دوربینی در این مرورگر در دسترس نیست؛ توکن چاپ‌شده زیر کد را وارد کنید.</p>
        )}
        <form onSubmit={resolve} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="referral-qr-token">توکن پذیرش</label>
          <Input id="referral-qr-token" value={token} onChange={(event) => { setToken(event.target.value); setResult(null); }} dir="ltr" autoComplete="off" placeholder="توکن کد پذیرش" maxLength={128} />
          <Button type="submit" className="min-h-11" loading={pending} disabled={pending || token.trim().length < 32}>
            <Search className="size-4" aria-hidden="true" />
            بررسی کد
          </Button>
        </form>
        {result ? (
          <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />ارجاع شناسایی شد</div>
              <StatusBadge label={STATUS_LABELS[result.referral?.status] || "ثبت‌شده"} variant={result.referral?.status === "finalized" ? "normal" : "preliminary"} />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">بیمار</p><p className="mt-1 font-medium">{result.patient?.display_name || "بیمار"}</p></div>
              <div><p className="text-xs text-muted-foreground">ارائه‌دهنده مقصد</p><p className="mt-1 font-medium">{result.provider?.display_name || "مرکز درمانی"}</p></div>
              <div><p className="text-xs text-muted-foreground">بیمه‌گر</p><p className="mt-1 font-medium">{PAYER_LABELS[result.payer?.payer_key] || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">شماره پیگیری</p><p dir="ltr" className="mt-1 text-start font-medium tabular-nums">{result.payer?.external_tracking_number || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">تاریخ تولد</p><p className="mt-1 font-medium">{result.patient?.date_of_birth ? new Date(result.patient.date_of_birth).toLocaleDateString("fa-IR") : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">زمان ارجاع</p><p className="mt-1 font-medium">{dateLabel(result.referral?.assigned_at)}</p></div>
            </div>
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-semibold">اقلام مختص این ارجاع</p>
              {(result.items || []).map((item) => (
                <div key={item.referral_item_id} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                  <div className="min-w-0"><p className="break-words font-medium">{item.display}</p><p className="mt-1 text-xs text-muted-foreground">{ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · {Number(item.quantity || 0).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} {item.unit || ""}</p></div>
                  <StatusBadge label={STATUS_LABELS[item.status] || "ثبت‌شده"} variant={item.status === "completed" ? "normal" : "neutral"} />
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">این نمایش فقط اطلاعات ارجاع تخصیص‌یافته به همین ارائه‌دهنده را شامل می‌شود.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
