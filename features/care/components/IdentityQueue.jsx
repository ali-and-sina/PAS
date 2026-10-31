"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CareFeedback } from "@/components/care/ActionControls";
import { reviewIdentityRequest } from "@/features/care/actions";
function Request({ request }) {
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(null);
  const router = useRouter();
  function review(decision) {
    startTransition(async () => {
      const result = await reviewIdentityRequest({ id: request.id, decision, note });
      setFeedback(result);
      if (result.ok) router.refresh();
    });
  }
  return <article className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{request.status === "processing" ? "ادامهٔ همگام‌سازی اطلاعات" : "درخواست اصلاح اطلاعات حساب"}</h2><p className="text-sm font-medium">{request.profile?.full_name || "کاربر"}</p>{request.profile?.phone && <p className="text-xs text-muted-foreground">شمارهٔ فعلی: <bdi>{request.profile.phone}</bdi></p>}{request.profile?.national_id && <p className="text-xs text-muted-foreground">کد ملی فعلی: <bdi>{request.profile.national_id}</bdi></p>}<p className="break-all text-xs text-muted-foreground">شناسهٔ حساب: {request.profile_id}</p>{request.requested_phone && <p className="text-sm">شمارهٔ درخواستی: <bdi>{request.requested_phone}</bdi></p>}{request.requested_national_id && <p className="text-sm">کد ملی درخواستی: <bdi>{request.requested_national_id}</bdi></p>}<label className="block space-y-2 text-sm"><span>توضیح بررسی</span><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} disabled={pending} /></label><label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-1.5 size-4 shrink-0" checked={verified} onChange={(e) => setVerified(e.target.checked)} disabled={pending} /><span>مالکیت شماره و هویت صاحب پرونده را بررسی و تأیید کرده‌ام.</span></label><div className="flex flex-wrap gap-2"><Button type="button" disabled={pending || !verified} loading={pending} onClick={() => review("approve")}>{request.status === "processing" ? "ادامهٔ بررسی و همگام‌سازی" : "تأیید و اعمال اصلاح"}</Button>{request.status === "pending" && <Button type="button" variant="outline" disabled={pending} onClick={() => review("reject")}>رد درخواست</Button>}</div><CareFeedback value={feedback} /></article>;
}
export default function IdentityQueue({ requests }) {
  return <div className="space-y-4">{requests.length ? requests.map((r) => <Request key={r.id} request={r} />) : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">درخواست باز وجود ندارد.</p>}</div>;
}
