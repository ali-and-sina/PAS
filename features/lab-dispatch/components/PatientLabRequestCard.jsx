"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Clock3, MapPin, QrCode, XCircle } from "lucide-react";

import { submitLabRequestToBranch } from "@/features/lab-dispatch/actions";
import { createPatientDispatchQrToken } from "@/features/lab-intake/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const QRCodeSvg = dynamic(() => import("@/components/shared/QRCodeSvg"), {
  ssr: false,
  loading: () => <div className="flex size-56 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">در حال آماده‌سازی کد…</div>,
});

const initialState = { ok: false, message: "" };
const REQUEST_STATUS = { submitted: "در انتظار اقدام", cancelled: "لغوشده", fulfilled: "انجام‌شده" };
const DISPATCH_STATUS = {
  pending: { label: "در انتظار پاسخ آزمایشگاه", icon: Clock3 },
  accepted: { label: "پذیرفته‌شده", icon: CheckCircle2 },
  rejected: { label: "ردشده", icon: XCircle },
  cancelled: { label: "لغوشده", icon: XCircle },
};
const HOME_STATUS = { requested: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده", scheduled: "زمان مراجعه تعیین شده", dispatched: "نمونه‌گیر اعزام شده", collected: "نمونه دریافت شده", cancelled: "لغوشده" };
function dateLabel(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function itemLabel(item) { return item.panel?.name_fa || item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"; }

export default function PatientLabRequestCard({ request, branches }) {
  const [state, formAction, pending] = useActionState(submitLabRequestToBranch, initialState);
  const [homeCollection, setHomeCollection] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [qr, setQr] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [isGenerating, startTransition] = useTransition();
  const qrRequestSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const latest = request.dispatches?.[0] || null;
  const hasActiveDispatch = latest && ["pending", "accepted"].includes(latest.status);
  const canSubmit = request.status === "submitted" && !hasActiveDispatch;
  const selectableBranches = useMemo(() => branches || [], [branches]);
  const selectedBranch = selectableBranches.find((branch) => branch.branch_id === selectedBranchId) || null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      qrRequestSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    qrRequestSequenceRef.current += 1;
    setQr(null);
    setFeedback("");
  }, [request.id]);

  async function generateQr(dispatchId) {
    const requestId = ++qrRequestSequenceRef.current;
    setFeedback("");
    setQr(null);
    startTransition(async () => {
      try {
        const result = await createPatientDispatchQrToken(dispatchId);
        if (!mountedRef.current || requestId !== qrRequestSequenceRef.current) return;
        if (!result?.ok) {
          setFeedback(result?.message || "ساخت کد پذیرش انجام نشد.");
          return;
        }
        const absoluteUrl = new URL(result.path, window.location.origin).toString();
        setQr({ dispatchId, url: absoluteUrl, token: result.token, expiresAt: result.expiresAt });
      } catch (error) {
        if (!mountedRef.current || requestId !== qrRequestSequenceRef.current) return;
        console.error("[PatientLabRequestCard:generateQr]", error);
        setFeedback("ساخت کد پذیرش انجام نشد؛ اتصال را بررسی کنید.");
      }
    });
  }

  async function copyQrValue() {
    if (!qr?.url) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setFeedback("نشانی کد پذیرش کپی شد.");
    } catch {
      setFeedback("کپی خودکار ممکن نشد؛ نشانی را از کادر زیر کپی کنید.");
    }
  }

  return (
    <article className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">درخواست آزمایش</p>
          <p className="mt-1 text-xs text-muted-foreground">ثبت‌شده در {dateLabel(request.created_at)}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs">{REQUEST_STATUS[request.status] || request.status}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {request.items?.map((item) => <span key={item.id} className="rounded-md bg-muted/70 px-2.5 py-1.5 text-xs">{itemLabel(item)}</span>)}
      </div>
      {request.clinical_note && <div className="rounded-lg bg-muted/30 p-3"><p className="text-xs font-medium text-muted-foreground">یادداشت بالینی</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{request.clinical_note}</p></div>}

      {latest ? (() => {
        const info = DISPATCH_STATUS[latest.status] || { label: latest.status, icon: Clock3 };
        const StatusIcon = info.icon;
        return <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 font-medium"><MapPin className="size-4 text-primary" aria-hidden="true" />{latest.branch?.display_name || "شعبه نامشخص"}</p><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><StatusIcon className="size-4" aria-hidden="true" />{info.label}</span></div>
          <p className="text-xs text-muted-foreground">{latest.branch?.city || "شهر ثبت نشده"} · ارسال در {dateLabel(latest.sent_at)}</p>
          {latest.response_note && <p className="text-sm">پاسخ آزمایشگاه: {latest.response_note}</p>}
          {latest.requested_home_collection && <p className="text-sm text-primary">نمونه‌گیری در منزل درخواست شده است.</p>}
          {latest.status === "pending" && <p className="text-xs leading-5 text-muted-foreground">پس از پذیرش آزمایشگاه، در صورت نیاز کد پذیرش تازه بسازید. کدهای قبلی با ساخت کد جدید باطل می‌شوند.</p>}
          {latest.status === "accepted" && latest.lab_order_id && <Button type="button" variant="outline" size="sm" onClick={() => generateQr(latest.id)} disabled={isGenerating} loading={isGenerating}><QrCode aria-hidden="true" />{isGenerating ? "در حال ساخت…" : "ساخت کد پذیرش"}</Button>}
          {latest.status === "pending" && <Button type="button" variant="outline" size="sm" onClick={() => generateQr(latest.id)} disabled={isGenerating}><QrCode aria-hidden="true" />{isGenerating ? "در حال ساخت…" : "نمایش کد پیگیری"}</Button>}
        </div>;
      })() : null}

      {request.dispatches?.filter((dispatch) => dispatch.requested_home_collection).map((dispatch) => {
        const collection = request.homeCollectionRequests?.find((row) => row.lab_dispatch_id === dispatch.id);
        return <div key={`home-${dispatch.id}`} className="rounded-lg border border-dashed p-3 text-sm"><p className="font-medium">نمونه‌گیری در منزل</p><p className="mt-1 text-muted-foreground">{HOME_STATUS[collection?.status] || (dispatch.requested_home_collection ? "درخواست نمونه‌گیری ثبت شده" : "—")}</p>{collection?.scheduled_for && <p className="mt-1">زمان مراجعه: {dateLabel(collection.scheduled_for)}</p>}</div>;
      })}

      {canSubmit && (
        <form action={formAction} className="space-y-4 rounded-xl bg-muted/30 p-4">
          <input type="hidden" name="request_id" value={request.id} />
          <div className="space-y-2"><Label htmlFor={`branch-${request.id}`}>انتخاب شعبهٔ آزمایشگاه</Label><select id={`branch-${request.id}`} name="branch_id" required value={selectedBranchId} onChange={(event) => { const nextId = event.target.value; setSelectedBranchId(nextId); const nextBranch = selectableBranches.find((branch) => branch.branch_id === nextId); if (!nextBranch?.supports_home_collection) setHomeCollection(false); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">یک شعبه انتخاب کنید</option>{selectableBranches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.name}{branch.city ? ` — ${branch.city}` : " — شهر نامشخص"}{branch.supports_home_collection ? " · نمونه‌گیری در منزل" : ""}</option>)}</select>{selectableBranches.length === 0 && <p className="text-xs text-destructive">فعلاً شعبهٔ فعالی برای انتخاب ثبت نشده است.</p>}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="requested_home_collection" checked={homeCollection} disabled={!selectedBranch?.supports_home_collection} onChange={(event) => setHomeCollection(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><span className="font-medium">درخواست نمونه‌گیری در منزل</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{selectedBranch ? (selectedBranch.supports_home_collection ? "این شعبه نمونه‌گیری در منزل را ارائه می‌دهد." : "شعبهٔ انتخاب‌شده نمونه‌گیری در منزل ندارد.") : "ابتدا شعبه را انتخاب کنید؛ فقط شعب پشتیبان امکان انتخاب این خدمت را دارند."}</span></span></label>
          {homeCollection && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor={`city-${request.id}`}>شهر</Label><Input id={`city-${request.id}`} name="city" required minLength={2} placeholder="نام شهر" /></div>
            <div className="space-y-1.5"><Label htmlFor={`phone-${request.id}`}>شماره تماس</Label><Input id={`phone-${request.id}`} name="contact_phone" required minLength={7} inputMode="tel" dir="ltr" placeholder="0912…" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`address-${request.id}`}>نشانی دقیق</Label><Textarea id={`address-${request.id}`} name="address" required minLength={5} rows={2} placeholder="خیابان، کوچه، پلاک و واحد" /></div>
            <div className="space-y-1.5"><Label htmlFor={`address2-${request.id}`}>توضیح تکمیلی نشانی</Label><Input id={`address2-${request.id}`} name="address_line2" /></div>
            <div className="space-y-1.5"><Label htmlFor={`postal-${request.id}`}>کد پستی</Label><Input id={`postal-${request.id}`} name="postal_code" dir="ltr" inputMode="numeric" /></div>
            <div className="space-y-1.5"><Label htmlFor={`window-${request.id}`}>زمان ترجیحی</Label><Input id={`window-${request.id}`} name="preferred_window" placeholder="مثلاً صبح‌ها" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`access-${request.id}`}>راهنمای دسترسی (اختیاری)</Label><Textarea id={`access-${request.id}`} name="access_instructions" rows={2} placeholder="اطلاعات لازم برای پیدا کردن نشانی یا ورود" /></div>
          </div>}
          {state.message && <p role={state.ok ? "status" : "alert"} className={`text-sm leading-6 ${state.ok ? "text-status-normal" : "text-destructive"}`}>{state.message}</p>}
          <Button type="submit" disabled={pending || selectableBranches.length === 0}>{pending ? "در حال ارسال…" : "ارسال درخواست به آزمایشگاه"}</Button>
        </form>
      )}

      {qr?.dispatchId === latest?.id && <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"><QRCodeSvg value={qr.url} title="کد پذیرش آزمایشگاه" /><div className="space-y-2"><p className="font-medium">کد پذیرش شما</p><p className="text-sm leading-6 text-muted-foreground">این کد را هنگام مراجعه به پذیرش نشان دهید. کد تا {dateLabel(qr.expiresAt)} معتبر است.</p><Input readOnly value={qr.url} dir="ltr" className="text-xs" aria-label="نشانی کد پذیرش" /><Button type="button" variant="outline" size="sm" onClick={copyQrValue}>کپی نشانی کد</Button></div></div>}
      {feedback && <p className="text-sm text-muted-foreground" role="status">{feedback}</p>}
    </article>
  );
}
