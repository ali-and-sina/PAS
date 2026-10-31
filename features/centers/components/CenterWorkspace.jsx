"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DisclosureSection from "@/components/shared/DisclosureSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarMonth, JalaliDateTimeField } from "@/components/care/JalaliCalendar";
import { useCareAction, CareFeedback, CommandButton } from "@/components/care/ActionControls";
import SpecialistReportForm from "./SpecialistReportForm";
import { centerBase } from "@/lib/centers/config";
import { MEDICAL_STATUS } from "@/lib/care/constants";
import { faNumber, tehranDayKey, persianDateLabel } from "@/lib/care/dates";
import { formatPersianDateTime } from "@/lib/utils/date-time";

function SessionForm({ request, today }) {
 const [time,setTime]=useState(""); const [interventions,setInterventions]=useState(""); const [progress,setProgress]=useState("");
 const [sessionId,setSessionId]=useState(null);
 const {run,pending,feedback}=useCareAction();
 const number=(request.pas_therapy_sessions||[]).length+1;
 return <form className="space-y-4 rounded-xl border bg-muted/30 p-4" onSubmit={e=>{e.preventDefault();const id=sessionId||crypto.randomUUID();setSessionId(id);run("medical.session",{id:request.id,session_id:id,session_number:number,occurred_at:time,interventions,progress_note:progress},()=>{setTime("");setInterventions("");setProgress("");setSessionId(null);});}}>
  <h3 className="font-semibold">ثبت جلسهٔ {faNumber(number)}</h3>
  <JalaliDateTimeField value={time} onChange={setTime} today={today} label="زمان انجام جلسه" disabled={pending} />
  <label className="block space-y-2 text-sm"><span>اقدامات انجام‌شده در جلسه</span><Textarea value={interventions} onChange={e=>setInterventions(e.target.value)} minLength={5} maxLength={4000} rows={3} required disabled={pending} /></label>
  <label className="block space-y-2 text-sm"><span>پاسخ بیمار و روند پیشرفت</span><Textarea value={progress} onChange={e=>setProgress(e.target.value)} minLength={5} maxLength={4000} rows={3} required disabled={pending} /></label>
  <Button type="submit" disabled={pending||!time} loading={pending}>ثبت جلسه در پرونده</Button><CareFeedback value={feedback} />
 </form>;
}
function AppointmentForm({request,today}) {
 const [time,setTime]=useState(request.scheduled_at||"");const {run,pending,feedback}=useCareAction();
 return <form className="space-y-3 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();run("medical.schedule",{id:request.id,scheduled_at:time});}}><JalaliDateTimeField value={time} onChange={setTime} today={today} label="نوبت تأییدشدهٔ مرکز" disabled={pending} /><Button type="submit" variant="outline" loading={pending} disabled={pending||!time}>ثبت نوبت</Button><CareFeedback value={feedback} /></form>;
}
function RequestCard({request,config,today,base,detail=false}) {
 const [correcting,setCorrecting]=useState(false);
 const results=[...(request.pas_medical_results||[])].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const superseded=new Set(results.map(r=>r.supersedes_id).filter(Boolean));const current=results.find(r=>!superseded.has(r.id));
 const active=["accepted","in_progress"].includes(request.status);
 return <article className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{request.service_name}</h2><p className="mt-2 text-sm">{request.patient_name||"بیمار"}</p><p className="mt-1 text-xs text-muted-foreground">پزشک ارجاع‌دهنده: {request.doctor_name||"—"}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{MEDICAL_STATUS[request.status]}</span></div>
  <p className="text-xs leading-6 text-muted-foreground">ثبت درخواست: {formatPersianDateTime(request.requested_at)}{request.scheduled_at&&<> · نوبت: {formatPersianDateTime(request.scheduled_at)}</>}</p>
  {request.clinical_note&&<p className="whitespace-pre-line break-words rounded-xl bg-muted/30 p-3 text-sm leading-7">{request.clinical_note}</p>}
  {request.service_details?.body_region&&<p className="text-sm">ناحیهٔ درخواست: {request.service_details.body_region}</p>}
  {request.service_kind==="physiotherapy"&&<p className="text-sm">جلسات ثبت‌شده: {faNumber(request.pas_therapy_sessions?.length||0)}{request.service_details?.requested_sessions&&<> از {faNumber(request.service_details.requested_sessions)} جلسهٔ پیشنهادی</>}</p>}
  {!detail?<Button asChild variant="outline"><Link href={base+"/requests/"+request.id}>{request.status==="reported"?"مشاهدهٔ گزارش":"بازکردن پرونده و اقدامات"}</Link></Button>:<>
   {request.status==="requested"&&<div className="flex flex-wrap gap-3"><CommandButton action="medical.advance" payload={{id:request.id,status:"accepted"}} variant="default">پذیرش در {config.label}</CommandButton><CommandButton action="medical.advance" payload={{id:request.id,status:"cancelled"}}>عدم پذیرش</CommandButton></div>}
   {request.status==="accepted"&&request.service_kind!=="physiotherapy"&&<CommandButton action="medical.advance" payload={{id:request.id,status:"in_progress"}}>شروع انجام خدمت</CommandButton>}
   {active&&<AppointmentForm request={request} today={today} />}
   {request.pas_therapy_sessions?.length>0&&<DisclosureSection title="سوابق جلسات" description="اقدامات ثبت‌شده و روند پیشرفت بیمار" meta={`${faNumber(request.pas_therapy_sessions.length)} جلسه`} defaultOpen stickySummary>{request.pas_therapy_sessions.map(s=><div key={s.id} className="space-y-2 rounded-xl border p-4 text-sm leading-7"><h4 className="font-medium">جلسهٔ {faNumber(s.session_number)} · {formatPersianDateTime(s.occurred_at)}</h4><p className="whitespace-pre-line break-words">{s.interventions}</p><p className="whitespace-pre-line break-words text-muted-foreground">{s.progress_note}</p></div>)}</DisclosureSection>}
   {active&&request.service_kind==="physiotherapy"&&<SessionForm request={request} today={today} />}
   {current&&<DisclosureSection title={config.report} description={`گزارش ثبت‌شده در ${formatPersianDateTime(current.created_at)}`} meta="گزارش آماده" defaultOpen stickySummary contentClassName="rounded-xl border border-primary/25 p-4"><dl className="space-y-4">{config.fields.filter(f=>current.measurements?.[f.key]).map(f=><div key={f.key}><dt className="text-xs text-muted-foreground">{f.label}</dt><dd className="mt-1 whitespace-pre-line break-words text-sm leading-8">{current.measurements[f.key]}</dd></div>)}</dl>{!Object.keys(current.measurements||{}).length&&<p className="whitespace-pre-line text-sm leading-8">{current.conclusion}</p>}{current.attachment_path&&<a href={"/api/care/files?bucket=pas-medical-documents&path="+encodeURIComponent(current.attachment_path)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">مشاهدهٔ پیوست خصوصی</a>}{results.length>1&&<details><summary className="cursor-pointer text-sm">نسخه‌های قبلی گزارش</summary>{results.filter(r=>r.id!==current.id).map(r=><p key={r.id} className="mt-3 whitespace-pre-line rounded-lg bg-muted/30 p-3 text-sm leading-7">{r.conclusion}</p>)}</details>}</DisclosureSection>}
   {active&&<SpecialistReportForm request={request} config={config} />}
   {request.status==="reported"&&<><Button variant="ghost" type="button" onClick={()=>setCorrecting(v=>!v)}>{correcting?"بستن فرم اصلاحیه":"ثبت اصلاحیه با حفظ گزارش قبلی"}</Button>{correcting&&<SpecialistReportForm key={current?.id} request={request} current={current} config={config} onSaved={()=>setCorrecting(false)} />}</>}
  </>}
 </article>;
}
function CenterCalendar({requests,today,base,month,total}) {
 const router=useRouter();const [selected,setSelected]=useState(null);
 const events=requests.filter(r=>r.scheduled_at&&r.status!=="cancelled").map(r=>({...r,day:tehranDayKey(r.scheduled_at)}));
 return <section className="max-w-3xl rounded-2xl border bg-card p-4 sm:p-6">{total>500&&<p className="mb-3 text-sm text-muted-foreground">این ماه بیش از ۵۰۰ نوبت دارد؛ جزئیات کامل را از فهرست پذیرش بررسی کنید.</p>}<CalendarMonth month={month} onMonthChange={month=>router.push(base+"/calendar?month="+month)} today={today} events={events} onSelect={setSelected} selected={selected} /><Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent><DialogTitle>نوبت‌های {selected?persianDateLabel(selected):"روز انتخابی"}</DialogTitle><DialogDescription>نوبت‌های ثبت‌شدهٔ همین مرکز</DialogDescription><div className="max-h-[60dvh] space-y-3 overflow-y-auto">{events.filter(r=>r.day===selected).map(r=><Link key={r.id} href={base+"/requests/"+r.id} className="block space-y-2 rounded-xl border p-4 text-sm hover:bg-muted"><span className="block font-medium">{r.patient_name} · {r.service_name}</span><span className="block text-muted-foreground">{formatPersianDateTime(r.scheduled_at)}</span></Link>)}{!events.some(r=>r.day===selected)&&<p className="py-4 text-sm text-muted-foreground">برای این روز نوبتی ثبت نشده است.</p>}</div></DialogContent></Dialog></section>;
}
export default function CenterWorkspace({data,view="dashboard",today}) {
 const {config,requests,user}=data;const base=centerBase(user.center_type);

 if(view==="calendar")return <CenterCalendar requests={requests} today={today} base={base} month={data.month} total={data.total} />;
 if(view==="detail")return requests[0]?<RequestCard key={requests[0].id} request={requests[0]} config={config} today={today} base={base} detail />:null;
 const filtered=requests;
 const pageHref=(page)=>{const params=new URLSearchParams();params.set("page",String(page));if(data.query)params.set("q",data.query);if(data.status)params.set("status",data.status);return base+"/"+view+"?"+params.toString();};
 return <div className="space-y-6">
  {view==="dashboard"?<><section className="space-y-3 rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{user.center_name}</p><h2 className="text-lg font-semibold">فضای اختصاصی {config.label}</h2><p className="text-sm leading-7 text-muted-foreground">{config.description}</p><div className="flex flex-wrap gap-3"><Button asChild><Link href={base+"/requests"}>{config.queue}</Link></Button><Button asChild variant="outline"><Link href={base+"/reports"}>{config.report}</Link></Button></div></section><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["requested","در انتظار پذیرش"],["accepted","پذیرش‌شده"],["in_progress",user.center_type==="physiotherapy"?"دورهٔ در حال انجام":"در حال انجام"],["reported","گزارش ثبت‌شده"]].map(([key,label])=><div key={key} className="space-y-3 rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{faNumber(data.counts?.[key]||0)}</p></div>)}</div><h2 className="text-lg font-semibold">درخواست‌های اخیر مرکز</h2></>:<form method="get" className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2"><label className="space-y-2 text-sm"><span className="block">جست‌وجوی بیمار یا خدمت</span><Input name="q" defaultValue={data.query} /></label>{view!=="reports"&&<label className="space-y-2 text-sm"><span className="block">وضعیت پذیرش</span><select name="status" defaultValue={data.status||""} className="min-h-11 w-full rounded-xl border bg-card px-3"><option value="">همهٔ وضعیت‌ها</option>{Object.entries(MEDICAL_STATUS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}<Button type="submit" variant="outline">جست‌وجو و نمایش</Button></form>}
  <div className="grid gap-4 xl:grid-cols-2">{(view==="dashboard"?filtered.slice(0,6):filtered).map(request=><RequestCard key={request.id} request={request} config={config} today={today} base={base} />)}</div>
  {view!=="dashboard"&&data.pages>1&&<nav aria-label="صفحه‌های پذیرش" className="flex flex-wrap items-center justify-between gap-3">{data.page>1&&<Button asChild variant="outline"><Link href={pageHref(data.page-1)}>صفحهٔ قبل</Link></Button>}<span className="text-sm text-muted-foreground">صفحهٔ {faNumber(data.page)} از {faNumber(data.pages)}</span>{data.page<data.pages&&<Button asChild variant="outline"><Link href={pageHref(data.page+1)}>صفحهٔ بعد</Link></Button>}</nav>}
  {!filtered.length&&<p className="rounded-2xl border border-dashed p-5 text-sm leading-7 text-muted-foreground">درخواست قابل مشاهده‌ای برای این بخش وجود ندارد. فقط ارجاع‌های متناسب با مجوز همین مرکز در این پنل نمایش داده می‌شوند.</p>}
 </div>;
}
