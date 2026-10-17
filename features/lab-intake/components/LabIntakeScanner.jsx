"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, CheckCircle2, Clipboard, ScanLine } from "lucide-react";

import { collectHomeSampleFromQr, resolveLabWorkflowQrToken } from "@/features/lab-intake/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LabCameraScanner = dynamic(() => import("./LabCameraScanner"), {
  ssr: false,
  loading: () => <div className="mt-4 flex aspect-video max-w-lg items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">در حال آماده‌سازی دوربین…</div>,
});

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
function extractToken(value) {
  const raw = String(value || "").trim();
  if (TOKEN_PATTERN.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = fragment.get("token") || "";
    return TOKEN_PATTERN.test(token) ? token.toLowerCase() : "";
  } catch {
    return "";
  }
}
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default function LabIntakeScanner() {
  const [inputValue, setInputValue] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const resolveRequestIdRef = useRef(0);
  const collectInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const resolveToken = useCallback(async (value) => {
    const requestId = ++resolveRequestIdRef.current;
    const token = extractToken(value);
    if (!token) {
      setBusy(false);
      setResult(null);
      setRawToken("");
      setMessage("کد QR معتبر نیست. نشانی کامل یا متن ۶۴ نویسه‌ای کد را وارد کنید.");
      return;
    }

    setBusy(true);
    setMessage("");
    setResult(null);
    setRawToken(token);

    try {
      const response = await resolveLabWorkflowQrToken(token);
      // The latest submitted token owns the visible result; late responses
      // from earlier requests are ignored rather than replacing newer data.
      if (!mountedRef.current || requestId !== resolveRequestIdRef.current) return;
      if (!response?.ok) {
        setMessage(response?.message || "کد پذیرش قابل تأیید نیست.");
        return;
      }
      setResult(response.data);
    } catch (error) {
      if (mountedRef.current && requestId === resolveRequestIdRef.current) {
        console.error("[LabIntakeScanner:resolveToken]", error);
        setMessage("بررسی کد انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.");
      }
    } finally {
      if (mountedRef.current && requestId === resolveRequestIdRef.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resolveRequestIdRef.current += 1;
    };
  }, []);

  const handleCameraDetected = useCallback((value) => {
    setScanning(false);
    void resolveToken(value);
  }, [resolveToken]);

  const handleCameraError = useCallback((errorMessage) => {
    setMessage(errorMessage);
    setScanning(false);
  }, []);

  async function markCollected() {
    const homeCollectionRequestId = result?.home_collection_request_id;
    const token = rawToken;
    if (!homeCollectionRequestId || !token || collectInFlightRef.current) return;

    // Bind this mutation to the QR result the staff member explicitly accepted.
    // A later scan must not receive the previous mutation's message or state.
    const operationId = ++resolveRequestIdRef.current;
    collectInFlightRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await collectHomeSampleFromQr({ homeCollectionRequestId, token });
      if (!mountedRef.current || operationId !== resolveRequestIdRef.current) return;
      if (!response?.ok) {
        setMessage(response?.message || "ثبت دریافت نمونه انجام نشد.");
        return;
      }
      setMessage("دریافت نمونه ثبت شد.");
      setResult((current) => current?.home_collection_request_id === homeCollectionRequestId
        ? { ...current, status: "collected", action_required: false }
        : current);
    } catch (error) {
      if (mountedRef.current && operationId === resolveRequestIdRef.current) {
        console.error("[LabIntakeScanner:markCollected]", error);
        setMessage("ثبت دریافت نمونه انجام نشد؛ اتصال را بررسی کنید.");
      }
    } finally {
      collectInFlightRef.current = false;
      if (mountedRef.current && operationId === resolveRequestIdRef.current) setBusy(false);
    }
  }

  const items = Array.isArray(result?.ordered_items) ? result.ordered_items : [];
  const isHomeCollection = result?.target_type === "home_collection";
  return <div className="space-y-5">
    <div className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">اسکن کد پذیرش</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">کدهای صادرشده برای شعبهٔ شما را اسکن کنید. اسکن به‌تنهایی وضعیت درخواست را تغییر نمی‌دهد.</p></div><Button type="button" variant="outline" disabled={busy} onClick={() => { setScanning((value) => !value); setMessage(""); }}><Camera aria-hidden="true" />{scanning ? "توقف دوربین" : "فعال‌کردن دوربین"}</Button></div>
      {scanning && <LabCameraScanner onDetected={handleCameraDetected} onError={handleCameraError} />}
      <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setScanning(false); void resolveToken(inputValue); }}><Input value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="نشانی QR یا متن کد را وارد کنید" autoComplete="off" dir="ltr" aria-label="کد پذیرش" /><Button type="submit" disabled={busy} loading={busy} aria-busy={busy}><ScanLine aria-hidden="true" />{busy ? "در حال بررسی…" : "بررسی کد"}</Button></form>
      {message && <p role="status" className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>}
    </div>

    {result && <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{isHomeCollection ? "درخواست نمونه‌گیری در منزل" : "درخواست آزمایش"}</p><h2 className="mt-1 text-lg font-semibold">{result.patient_name || "درخواست بیمار"}</h2><p className="mt-1 text-sm text-muted-foreground">{result.branch_name || "شعبه"}{result.branch_city ? ` · ${result.branch_city}` : ""}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{isHomeCollection ? ({ scheduled: "زمان‌بندی‌شده", dispatched: "نمونه‌گیر اعزام‌شده", collected: "نمونه دریافت‌شده" }[result.status] || result.status) : ({ pending: "در انتظار پذیرش", accepted: "پذیرفته‌شده", rejected: "ردشده", cancelled: "لغوشده" }[result.status] || result.status)}</span></div>
      {items.length > 0 && <div className="flex flex-wrap gap-2">{items.map((item, index) => <span key={item.request_item_id || index} className="rounded-md bg-muted px-2.5 py-1.5 text-xs">{item.name || "آزمایش"}</span>)}</div>}
      <dl className="grid gap-3 rounded-xl bg-muted/30 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">شناسه درخواست</dt><dd className="mt-1 break-all font-mono text-xs" dir="ltr">{result.request_id || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">زمان ارسال</dt><dd className="mt-1">{formatDate(result.sent_at)}</dd></div><div><dt className="text-xs text-muted-foreground">کد وضعیت</dt><dd className="mt-1">{result.status}</dd></div>{result.home_collection_status && <div><dt className="text-xs text-muted-foreground">وضعیت نمونه‌گیری</dt><dd className="mt-1">{result.home_collection_status}</dd></div>}</dl>
      {isHomeCollection && result.status === "dispatched" && <Button type="button" onClick={markCollected} disabled={busy} loading={busy}><CheckCircle2 aria-hidden="true" />{busy ? "در حال ثبت…" : "ثبت دریافت نمونه"}</Button>}
      {isHomeCollection && result.status === "collected" && <p className="flex items-center gap-2 text-sm text-status-normal"><Clipboard aria-hidden="true" />دریافت این نمونه قبلاً ثبت شده است.</p>}
    </section>}
  </div>;
}
