"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import dynamic from "next/dynamic";
import { CalendarClock, CheckCircle2, MapPin, QrCode, Truck } from "lucide-react";

import { advanceHomeCollectionRequest, getHomeCollectionPrivateDetailsAction } from "@/features/home-collection/actions";
import { createHomeCollectionQrToken } from "@/features/lab-intake/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const QRCodeSvg = dynamic(() => import("@/components/shared/QRCodeSvg"), {
  ssr: false,
  loading: () => <div className="flex size-56 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">در حال آماده‌سازی کد…</div>,
});

const initialState = { ok: false, message: "" };
const LABEL = { requested: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده", scheduled: "زمان مراجعه تعیین‌شده", dispatched: "نمونه‌گیر اعزام‌شده", collected: "نمونه دریافت‌شده", cancelled: "لغوشده" };
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

function StatusForm({ requestId, nextStatus, formAction, pending, collectorProfileId, timezoneOffset, children, showSchedule = false }) {
  return <form action={formAction} className="space-y-2 rounded-lg border p-3">
    <input type="hidden" name="home_collection_request_id" value={requestId} />
    <input type="hidden" name="next_status" value={nextStatus} />
    {showSchedule && <><label className="block text-xs font-medium" htmlFor={`schedule-${requestId}`}>زمان مراجعه (به وقت محلی شما)</label><Input id={`schedule-${requestId}`} type="datetime-local" name="scheduled_for" required /><input type="hidden" name="timezone_offset_minutes" value={timezoneOffset} />{collectorProfileId && <input type="hidden" name="collector_profile_id" value={collectorProfileId} />}</>}
    {nextStatus === "rejected" && <Textarea name="note" rows={2} maxLength={1000} placeholder="دلیل رد (اختیاری)" />}
    {children || <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "در حال ثبت…" : "ثبت وضعیت"}</Button>}
  </form>;
}

export default function HomeCollectionActionCard({ request, collectorProfileId }) {
  const [state, formAction, pending] = useActionState(advanceHomeCollectionRequest, initialState);
  const [address, setAddress] = useState(null);
  const [addressMessage, setAddressMessage] = useState("");
  const [qr, setQr] = useState(null);
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const [busy, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState(null);
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const details = request.dispatch || {};
  const canViewAddress = ["approved", "scheduled", "dispatched"].includes(request.status);

  useEffect(() => { setTimezoneOffset(new Date().getTimezoneOffset()); }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);


  useEffect(() => {
    requestSequenceRef.current += 1;
    setAddress(null);
    setQr(null);
    setAddressMessage("");
    setBusyAction(null);
  }, [request.id]);

  async function showAddress() {
    setBusyAction("address");
    const requestId = ++requestSequenceRef.current;
    setAddressMessage("");
    setAddress(null);
    startTransition(async () => {
      try {
        const result = await getHomeCollectionPrivateDetailsAction(request.id);
        if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
        if (!result?.ok) {
          setAddressMessage(result?.message || "نشانی دریافت نشد.");
          return;
        }
        setAddress(result.data);
      } catch (error) {
        if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
        console.error("[HomeCollectionActionCard:showAddress]", error);
        setAddressMessage("دریافت نشانی انجام نشد؛ اتصال را بررسی کنید.");
      }
    });
  }

  async function makeQr() {
    setBusyAction("qr");
    const requestId = ++requestSequenceRef.current;
    setAddressMessage("");
    setQr(null);
    startTransition(async () => {
      try {
        const result = await createHomeCollectionQrToken(request.id);
        if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
        if (!result?.ok) {
          setAddressMessage(result?.message || "ساخت کد انجام نشد.");
          return;
        }
        setQr({ url: new URL(result.path, window.location.origin).toString(), expiresAt: result.expiresAt });
      } catch (error) {
        if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
        console.error("[HomeCollectionActionCard:makeQr]", error);
        setAddressMessage("ساخت کد انجام نشد؛ اتصال را بررسی کنید.");
      }
    });
  }

  function hideAddress() {
    requestSequenceRef.current += 1;
    setAddress(null);
    setAddressMessage("");
  }

  return <article className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{details.patient_name || "بیمار"}</h2><p className="mt-1 text-xs text-muted-foreground">{details.branch_name || "شعبه آزمایشگاه"}{details.branch_city ? ` · ${details.branch_city}` : ""}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{LABEL[request.status] || request.status}</span></div>
    <div className="flex flex-wrap gap-2">{(details.ordered_items || []).map((item, index) => <span key={item.request_item_id || index} className="rounded-md bg-muted px-2 py-1 text-xs">{item.name || "آزمایش"}</span>)}</div>
    <p className="text-xs text-muted-foreground">درخواست‌شده در {formatDate(request.requested_at)}{request.scheduled_for ? ` · زمان مراجعه: ${formatDate(request.scheduled_for)}` : ""}</p>
    {request.rejection_reason && <p className="text-sm text-destructive">دلیل رد: {request.rejection_reason}</p>}

    {request.status === "requested" && <div className="grid gap-3 sm:grid-cols-2">{details.status === "accepted" && details.lab_order_id ? <StatusForm requestId={request.id} nextStatus="approved" formAction={formAction} pending={pending} timezoneOffset={timezoneOffset}><Button type="submit" size="sm" disabled={pending}><CheckCircle2 aria-hidden="true" />تأیید درخواست</Button></StatusForm> : <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">برای تأیید نمونه‌گیری، ابتدا درخواست آزمایش را در صف درخواست‌های ارجاع‌شده بپذیرید.</p>}<StatusForm requestId={request.id} nextStatus="rejected" formAction={formAction} pending={pending} timezoneOffset={timezoneOffset}><Button type="submit" variant="outline" size="sm" disabled={pending}>رد درخواست نمونه‌گیری</Button></StatusForm></div>}
    {request.status === "approved" && <StatusForm requestId={request.id} nextStatus="scheduled" formAction={formAction} pending={pending} collectorProfileId={collectorProfileId} timezoneOffset={timezoneOffset} showSchedule><Button type="submit" size="sm" disabled={pending || !collectorProfileId}><CalendarClock aria-hidden="true" />ثبت زمان مراجعه</Button></StatusForm>}
    {request.status === "scheduled" && <StatusForm requestId={request.id} nextStatus="dispatched" formAction={formAction} pending={pending} timezoneOffset={timezoneOffset}><Button type="submit" size="sm" disabled={pending}><Truck aria-hidden="true" />ثبت اعزام نمونه‌گیر</Button></StatusForm>}
    {canViewAddress && <Button type="button" variant="outline" size="sm" onClick={showAddress} disabled={busy} loading={busy && busyAction === "address"}><MapPin aria-hidden="true" />{busy ? "در حال دریافت…" : "نمایش نشانی امن"}</Button>}
    {request.status === "dispatched" && <Button type="button" variant="outline" size="sm" onClick={makeQr} disabled={busy} loading={busy && busyAction === "qr"}><QrCode aria-hidden="true" />ساخت کد دریافت نمونه</Button>}
    {address && <div className="space-y-2 rounded-xl border border-primary/20 bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">نشانی خصوصی نمونه‌گیری</p><button type="button" className="text-xs text-muted-foreground underline" onClick={hideAddress}>پنهان‌کردن</button></div><p className="text-sm">{address.city}، {address.address}{address.address_line2 ? `، ${address.address_line2}` : ""}</p><p className="text-sm">شماره تماس: <span dir="ltr">{address.contact_phone}</span></p>{address.postal_code && <p className="text-sm">کد پستی: <span dir="ltr">{address.postal_code}</span></p>}{address.access_instructions && <p className="text-sm leading-6">راهنمای دسترسی: {address.access_instructions}</p>}{address.preferred_window && <p className="text-sm">زمان ترجیحی: {address.preferred_window}</p>}</div>}
    {qr && <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[auto_1fr] sm:items-center"><QRCodeSvg value={qr.url} title="کد دریافت نمونه در منزل" /><div><p className="font-medium">کد دریافت نمونه</p><p className="mt-1 text-sm text-muted-foreground">اعتبار تا {formatDate(qr.expiresAt)}</p><Input className="mt-2 text-xs" value={qr.url} readOnly dir="ltr" aria-label="نشانی کد دریافت نمونه" /></div></div>}
    {(state.message || addressMessage) && <p role={state.ok ? "status" : "alert"} className={`text-sm leading-6 ${state.ok ? "text-status-normal" : "text-destructive"}`}>{state.message || addressMessage}</p>}
  </article>;
}
