"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getCareMessages, createCareUpload, runCareCommand } from "@/features/care/actions";
import { useCareAction, CareFeedback, CommandButton } from "@/components/care/ActionControls";
import { RECORD_SCOPES, CONSULTATION_STATUS } from "@/lib/care/constants";
import ChatVoiceRecorder from "./ChatVoiceRecorder";
import VoiceVisitNoteRecorder from "@/features/physician-care/components/VoiceVisitNoteRecorder";
import VoiceRecordingConsentCard from "@/features/physician-care/components/VoiceRecordingConsentCard";
import VisitClosureForm from "./VisitClosureForm";

function ConsultationChat({ request, user }) {
  const [messages, setMessages] = useState([]);
  const [hasOlder,setHasOlder]=useState(false);
  const firstLoad=useRef(true);
  const mergeMessages=(previous,incoming)=>[...new Map([...previous,...incoming].map(m=>[m.id,m])).values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));
  const [status, setStatus] = useState(request.status);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const retryId = useRef(null);
  const router = useRouter();
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const result = await getCareMessages(request.id);
        if (live && result.ok) { setMessages(old=>mergeMessages(old,result.messages)); setStatus(result.status); if(firstLoad.current){setHasOlder(result.hasMore);firstLoad.current=false;} }
        else if (live) setError(result.message || "پیام‌ها دریافت نشدند.");
      } catch { if (live) setError("پیام‌ها دریافت نشدند."); }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { live = false; clearInterval(interval); };
  }, [request.id]);
  function sendText(event) {
    event.preventDefault();
    if (!body.trim()) return;
    retryId.current ||= crypto.randomUUID();
    setError("");
    startTransition(async () => {
      const result = await runCareCommand("consultation.message", { id: retryId.current, consultation_id: request.id, body: body.trim() });
      if (!result.ok) return setError(result.message);
      retryId.current = null;
      setBody("");
      const updated = await getCareMessages(request.id);
      if (updated.ok) setMessages(old=>mergeMessages(old,updated.messages));
    });
  }
  function sendAudio(blob, clear) {
    setError("");
    startTransition(async () => {
      try {
        const id = crypto.randomUUID();
        const upload = await createCareUpload({ kind: "consultation-audio", resourceId: request.id, messageId: id, mimeType: blob.type, fileSize: blob.size });
        if (!upload.ok) return setError(upload.message);
        const db = createClient();
        const { error: uploadError } = await db.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, blob, { contentType: blob.type });
        if (uploadError) return setError("بارگذاری ویس انجام نشد.");
        const result = await runCareCommand("consultation.message", { id, consultation_id: request.id, audio_path: upload.path });
        if (!result.ok) return setError(result.message);
        clear();
        const updated = await getCareMessages(request.id);
        if (updated.ok) setMessages(old=>mergeMessages(old,updated.messages));
      } catch { setError("ارسال ویس انجام نشد."); }
    });
  }
  return <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label="گفت‌وگوی ویزیت">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">گفت‌وگوی ویزیت</h3><span className="text-xs text-muted-foreground">{CONSULTATION_STATUS[status]}</span></div>
    {hasOlder && <Button type="button" variant="ghost" disabled={pending} onClick={()=>startTransition(async()=>{const oldest=messages[0];if(!oldest)return;const result=await getCareMessages(request.id,{id:oldest.id,created_at:oldest.created_at});if(result.ok){setMessages(old=>mergeMessages(old,result.messages));setHasOlder(result.hasMore);}else setError(result.message);})}>پیام‌های قدیمی‌تر</Button>}
    <div className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl bg-muted/30 p-3">
      {!messages.length && <p className="py-4 text-center text-sm text-muted-foreground">گفت‌وگو را آغاز کنید.</p>}
      {messages.map((message) => <div key={message.id} className={"max-w-[95%] rounded-xl border p-3 text-sm leading-7 sm:max-w-[85%] " + (message.sender_id === user.id ? "ms-auto border-primary/20 bg-primary/5" : "me-auto bg-card")}><p className="mb-1 text-xs font-semibold text-muted-foreground">{message.sender_id === user.id ? "شما" : user.role === "patient" ? request.doctor_name : request.patient_name}</p>{message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : message.audio_url ? <audio controls preload="none" src={message.audio_url} className="max-w-full" aria-label="پیام صوتی ویزیت" /> : <p>ویس در دسترس نیست.</p>}</div>)}
    </div>
    {status === "accepted" && <>
      <form onSubmit={sendText} className="space-y-2"><label className="block space-y-2 text-sm"><span>پیام جدید</span><Textarea value={body} onChange={(e) => { setBody(e.target.value); retryId.current = null; }} maxLength={4000} rows={3} required disabled={pending} /></label><Button type="submit" loading={pending} disabled={pending || !body.trim()}>ارسال پیام</Button></form>
      <ChatVoiceRecorder onSend={sendAudio} disabled={pending} />
      {user.role === "doctor" && request.visit_id && <>
        <VisitClosureForm visitId={request.visit_id} />
        <details className="rounded-xl border p-4"><summary className="min-h-8 cursor-pointer text-sm font-semibold">ثبت خلاصهٔ صوتی و ختم ویزیت</summary><p className="my-3 text-xs leading-6 text-muted-foreground">ثبت نهایی این یادداشت، ویزیت را خودکار مختومه می‌کند. رضایت بیمار برای یادداشت صوتی باید فعال باشد.</p><VoiceVisitNoteRecorder patientId={request.patient_id} visits={[{id:request.visit_id,status:"in_progress",visit_date:request.accepted_at}]} /></details>
      </>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {status === "completed" && <Button type="button" variant="ghost" onClick={() => router.refresh()}>تازه‌سازی پرونده</Button>}
  </section>;
}
export default function ConsultationsBoard({ data }) {
  const { user, doctors, requests, availability, now } = data;
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState(["visits"]);
  const [opened, setOpened] = useState(null);
  const [capacity, setCapacity] = useState(availability?.capacity || 1);
  const { run, pending, feedback } = useCareAction();
  const available = Boolean(availability?.is_available && Date.parse(availability.expires_at) > Date.parse(now));
  return <div className="space-y-6">
    {user.role === "doctor" ? <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5"><div><h2 className="font-semibold">پذیرش ویزیت آنلاین</h2><p className="mt-1 text-sm text-muted-foreground">{available ? "تا یک ساعت پس از آخرین فعال‌سازی، در فهرست پزشکان در دسترس هستید." : "در حال حاضر برای درخواست‌های جدید در دسترس نیستید."}</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 text-sm"><span>ظرفیت هم‌زمان</span><select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="min-h-11 rounded-xl border bg-card px-3" disabled={pending}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n.toLocaleString("fa-IR")}</option>)}</select></label><Button type="button" disabled={pending} loading={pending} variant={available ? "outline" : "default"} onClick={() => run("availability.set", { is_available: !available, capacity })}>{available ? "پایان پذیرش آنلاین" : "فعال‌سازی پذیرش آنلاین"}</Button>{available && <Button type="button" variant="ghost" disabled={pending} onClick={() => run("availability.set", { is_available: true, capacity })}>تمدید یک‌ساعته</Button>}</div></section> :
      <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">پزشکان در دسترس و پزشکان من</h2><Input aria-label="جست‌وجوی نام یا تخصص پزشک" placeholder="نام یا تخصص پزشک" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">{doctors.filter((d) => (d.full_name + " " + (d.specialty || "")).includes(search.trim())).map((doctor) => <article key={doctor.doctor_id} className={"space-y-3 rounded-xl border p-4 " + (selected === doctor.doctor_id ? "border-primary bg-primary/5" : "")}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{doctor.full_name}</h3><span className={doctor.available ? "text-xs text-emerald-800" : "text-xs text-muted-foreground"}>{doctor.available ? "در دسترس" : "پزشک من؛ پاسخ در زمان حضور"}</span></div><p className="text-sm text-muted-foreground">{doctor.specialty || "پزشک"}</p><Button type="button" variant="outline" disabled={pending} onClick={() => setSelected(doctor.doctor_id)}>درخواست ویزیت</Button></article>)}</div>
        {!doctors.length && <p className="rounded-xl bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">پزشک در دسترس یا پزشک مرتبطی برای نمایش وجود ندارد. پزشک می‌تواند پذیرش آنلاین را از پنل خود فعال کند.</p>}
        {selected && <form className="space-y-4 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); run("consultation.request", { doctor_id: selected, reason, scopes: scope }, () => { setReason(""); setSelected(null); }); }}><h3 className="font-semibold">درخواست برای {doctors.find((d) => d.doctor_id === selected)?.full_name}</h3><label className="block space-y-2 text-sm"><span>علت مراجعه و توضیحات</span><Textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={2500} rows={4} required disabled={pending} /></label><fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">اطلاعاتی که در اختیار پزشک می‌گذارید</legend>{RECORD_SCOPES.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-teal-700" checked={scope.includes(key)} disabled={pending || key === "visits"} onChange={(e) => setScope((old) => e.target.checked ? [...old, key] : old.filter((v) => v !== key))} />{label}</label>)}</fieldset><p className="text-xs leading-6 text-muted-foreground">برای پزشک جدید، مجوزهای انتخابی تا هفت روز فعال‌اند. تنظیمات دسترسی قبلی پزشک باقی می‌ماند و از بخش دسترسی پرونده قابل تغییر است.</p><div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending} loading={pending}>ثبت درخواست و مجوز ویزیت</Button><Button type="button" variant="ghost" onClick={() => setSelected(null)}>انصراف</Button></div></form>}
      </section>}
    <CareFeedback value={feedback} />
    {user.role === "patient" && <details className="rounded-2xl border bg-card p-4"><summary className="min-h-8 cursor-pointer text-sm font-semibold">مجوز یادداشت صوتی ویزیت</summary><div className="mt-4"><VoiceRecordingConsentCard initialGranted={data.voiceConsent?.granted || false} grantedAt={data.voiceConsent?.grantedAt || null} /></div></details>}
    <section className="space-y-4"><h2 className="text-lg font-semibold">ویزیت‌های آنلاین</h2>{!requests.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">هنوز درخواست ویزیتی ثبت نشده است.</p>}
      {requests.map((request) => <article key={request.id} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{user.role === "patient" ? request.doctor_name : request.patient_name}</h3><p className="mt-1 text-xs text-muted-foreground">{CONSULTATION_STATUS[request.status]}</p></div>{user.role === "doctor" && request.status !== "requested" && <Link href={"/doctor/patients/" + request.patient_id} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">پروندهٔ مجاز بیمار</Link>}</div><p className="whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{request.reason}</p>
        {request.status === "requested" ? <div className="flex flex-wrap gap-2">{user.role === "doctor" && <CommandButton action="consultation.accept" payload={{ id: request.id }} variant="default">پذیرش و شروع ویزیت</CommandButton>}<CommandButton action="consultation.cancel" payload={{ id: request.id }}>{user.role === "doctor" ? "نپذیرفتن درخواست" : "لغو درخواست"}</CommandButton></div> : ["accepted", "completed"].includes(request.status) && <Button type="button" variant="outline" onClick={() => setOpened(opened === request.id ? null : request.id)}>{opened === request.id ? "بستن گفت‌وگو" : "مشاهدهٔ گفت‌وگو"}</Button>}
        {opened === request.id && <ConsultationChat request={request} user={user} />}
      </article>)}
    </section>
  </div>;
}
