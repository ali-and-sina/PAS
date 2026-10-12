"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { CheckCircle2, Clock3, MapPin, UserRound, XCircle } from "lucide-react";

import { acceptLabDispatch, rejectLabDispatch } from "@/features/lab-dispatch/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const rejectInitial = { ok: false, message: "" };
const STATUS = { pending: "در انتظار پاسخ", accepted: "پذیرفته‌شده", rejected: "ردشده", cancelled: "لغوشده" };
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default function LabDispatchCard({ dispatch }) {
  const [rejectState, rejectAction, rejecting] = useActionState(rejectLabDispatch, rejectInitial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const actionable = dispatch.status === "pending";

  function accept() {
    setFeedback("");
    startTransition(async () => {
      const result = await acceptLabDispatch(dispatch.dispatch_id || dispatch.id);
      if (!result?.ok) setFeedback(result?.message || "پذیرش درخواست انجام نشد.");
    });
  }

  const items = Array.isArray(dispatch.ordered_items) ? dispatch.ordered_items : [];

  return <article className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">{dispatch.patient_name || "بیمار"}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="size-3.5" aria-hidden="true" />پزشک: {dispatch.doctor_name || "—"}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs ${dispatch.status === "accepted" ? "bg-emerald-50 text-emerald-800" : dispatch.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}>{STATUS[dispatch.status] || dispatch.status}</span>
    </div>
    <div className="flex flex-wrap gap-2">{items.map((item, index) => <span key={item.request_item_id || `${item.item_id}-${index}`} className="rounded-md bg-muted px-2.5 py-1.5 text-xs">{item.name || "آزمایش"}</span>)}</div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{dispatch.branch_name || "شعبه آزمایشگاه"}{dispatch.branch_city ? `، ${dispatch.branch_city}` : ""}</span><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />ارسال: {formatDate(dispatch.sent_at)}</span></div>
    {dispatch.requested_home_collection && <p className="rounded-lg bg-accent/50 p-3 text-sm text-primary">این درخواست شامل نمونه‌گیری در منزل نیز هست.</p>}
    {dispatch.clinical_note && <div className="rounded-lg border p-3"><p className="text-xs font-medium text-muted-foreground">یادداشت بالینی</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{dispatch.clinical_note}</p></div>}
    {dispatch.response_note && <p className="text-sm text-muted-foreground">پاسخ ثبت‌شده: {dispatch.response_note}</p>}
    {actionable && <div className="grid gap-3 sm:grid-cols-2">
      <Button type="button" onClick={accept} disabled={pending || rejecting}><CheckCircle2 aria-hidden="true" />{pending ? "در حال ثبت…" : "پذیرش درخواست"}</Button>
      <form action={rejectAction} className="space-y-2 rounded-lg border p-3"><input type="hidden" name="dispatch_id" value={dispatch.dispatch_id || dispatch.id} /><Textarea name="response_note" rows={2} maxLength={1000} placeholder="دلیل رد درخواست (اختیاری)" aria-label="دلیل رد درخواست" />{rejectState.message && <p role={rejectState.ok ? "status" : "alert"} className={`text-xs ${rejectState.ok ? "text-status-normal" : "text-destructive"}`}>{rejectState.message}</p>}<Button type="submit" variant="outline" className="w-full" disabled={rejecting || pending}><XCircle aria-hidden="true" />{rejecting ? "در حال ثبت…" : "رد درخواست"}</Button></form>
    </div>}
    {feedback && <p role="alert" className="text-sm text-destructive">{feedback}</p>}
  </article>;
}
