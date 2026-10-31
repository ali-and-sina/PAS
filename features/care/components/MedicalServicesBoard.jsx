"use client";

import { useState } from "react";

import DisclosureSection from "@/components/shared/DisclosureSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JalaliDateTimeField } from "@/components/care/JalaliCalendar";
import { useCareAction, CareFeedback, CommandButton } from "@/components/care/ActionControls";
import { centerForService } from "@/lib/centers/config";
import { SERVICE_KINDS, MEDICAL_STATUS } from "@/lib/care/constants";
import { tehranDayKey } from "@/lib/care/dates";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MedicalRequestCard({ request, data }) {
  const [provider, setProvider] = useState("");
  const results = [...(request.pas_medical_results || [])].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const superseded = new Set(results.map((result) => result.supersedes_id).filter(Boolean));
  const current = results.find((result) => !superseded.has(result.id));
  const providerName = data.providers.find((item) => item.provider_id === request.provider_id)?.display_name;
  const providers = data.providers.filter((item) => item.services.includes(request.service_kind));

  return (
    <article className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{request.service_name}</h3>
          {data.user.role === "doctor" ? (
            <p className="mt-1 text-sm font-medium">بیمار: {request.patient_name || "بیمار"}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {SERVICE_KINDS.find(([key]) => key === request.service_kind)?.[1] || "خدمت پزشکی"}
            {" · "}
            {providerName || "مرکز هنوز انتخاب نشده است"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">ثبت درخواست: {formatDate(request.requested_at)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs">
          {MEDICAL_STATUS[request.status] || "وضعیت نامشخص"}
        </span>
      </div>

      {request.clinical_note ? (
        <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{request.clinical_note}</p>
      ) : null}

      {data.user.role === "patient" && !request.provider_id && request.status === "requested" ? (
        <div className="space-y-2 rounded-xl bg-muted/30 p-3">
          <label className="block space-y-2 text-sm">
            <span>انتخاب مرکز ارائه‌دهنده</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="min-h-11 w-full rounded-xl border bg-card px-3"
            >
              <option value="">انتخاب مرکز</option>
              {providers.map((item) => (
                <option key={item.provider_id} value={item.provider_id}>{item.display_name}</option>
              ))}
            </select>
          </label>
          {providers.length ? (
            <CommandButton
              action="medical.assign"
              payload={{ id: request.id, provider_id: provider }}
              disabled={!provider}
            >
              ارسال درخواست به مرکز انتخاب‌شده
            </CommandButton>
          ) : (
            <p className="text-xs text-muted-foreground">هنوز مرکزی برای این خدمت در فهرست ثبت نشده است.</p>
          )}
        </div>
      ) : null}

      {request.pas_therapy_sessions?.length ? (
        <DisclosureSection
          title="جلسات فیزیوتراپی ثبت‌شده"
          description="اقدامات و روند پیشرفت هر جلسه"
          meta={`${new Intl.NumberFormat("fa-IR").format(request.pas_therapy_sessions.length)} جلسه`}
          stickySummary
        >
          {request.pas_therapy_sessions.map((session) => (
            <div key={session.id} className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p>جلسهٔ {new Intl.NumberFormat("fa-IR").format(session.session_number)}</p>
              <p className="whitespace-pre-line">{session.interventions}</p>
              <p className="whitespace-pre-line">{session.progress_note}</p>
            </div>
          ))}
        </DisclosureSection>
      ) : null}

      {current ? (
        <DisclosureSection
          title="گزارش مرکز درمانی"
          description={`گزارش ثبت‌شده در ${formatDate(current.created_at)}`}
          meta="گزارش آماده"
          defaultOpen
          stickySummary
          contentClassName="rounded-xl border border-primary/20 p-4"
        >
          <p className="whitespace-pre-line break-words text-sm leading-8">{current.conclusion}</p>
          {Object.keys(current.measurements || {}).length > 0 ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(centerForService(request.service_kind)?.fields || [])
                .filter((field) => current.measurements[field.key] !== null
                  && current.measurements[field.key] !== undefined
                  && current.measurements[field.key] !== "")
                .map((field) => (
                  <div key={field.key}>
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="mt-1 whitespace-pre-line break-words leading-7">{current.measurements[field.key]}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {current.attachment_path ? (
            <a
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              href={`/api/care/files?bucket=pas-medical-documents&path=${encodeURIComponent(current.attachment_path)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              مشاهدهٔ پیوست خصوصی
            </a>
          ) : null}
          {results.length > 1 ? (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">نسخه‌های قبلی گزارش</summary>
              <ul className="mt-3 space-y-3">
                {results.filter((result) => result.id !== current.id).map((result) => (
                  <li key={result.id} className="rounded-lg border p-3 text-sm leading-7">
                    <p className="mb-1 text-xs text-muted-foreground">{formatDate(result.created_at)}</p>
                    {result.conclusion}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </DisclosureSection>
      ) : null}
    </article>
  );
}

function MedicalServiceRequestForm({ data, patients, today, defaultPatientId = "", initialKind = "ct", lockKind = false }) {
  const [patient, setPatient] = useState(defaultPatientId || patients[0]?.id || "");
  const [kind, setKind] = useState(initialKind);
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [bodyRegion, setBodyRegion] = useState("");
  const [sessions, setSessions] = useState(10);
  const { run, pending, feedback } = useCareAction();
  const availableProviders = data.providers.filter((item) => item.services.includes(kind));

  function submitRequest(event) {
    event.preventDefault();
    run("medical.request", {
      patient_id: patient,
      provider_id: provider || null,
      service_kind: kind,
      service_name: name,
      clinical_note: note,
      scheduled_at: scheduled || null,
      service_details: kind === "physiotherapy"
        ? { requested_sessions: Number(sessions) }
        : { body_region: bodyRegion },
    }, () => {
      setName("");
      setNote("");
      setScheduled("");
      setBodyRegion("");
    });
  }

  if (!patients.length) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">
        ابتدا یک بیمار با رابطهٔ فعال به فهرست خود اضافه کنید تا بتوانید برای او خدمت پزشکی ثبت کنید.
      </div>
    );
  }

  return (
    <form className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={submitRequest}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span>بیمار</span>
          <select value={patient} onChange={(event) => setPatient(event.target.value)} required className="min-h-11 w-full rounded-xl border bg-card px-3" disabled={pending}>
            <option value="">انتخاب بیمار</option>
            {patients.map((item) => <option key={item.id} value={item.id}>{item.full_name || "بیمار"}</option>)}
          </select>
        </label>
        <div className="space-y-2 text-sm">
          <span className="block">نوع خدمت</span>
          {lockKind ? (
            <div className="flex min-h-11 items-center rounded-xl border bg-muted/30 px-3 font-medium">
              {SERVICE_KINDS.find(([key]) => key === kind)?.[1] || "خدمت پزشکی"}
            </div>
          ) : (
            <select value={kind} onChange={(event) => { setKind(event.target.value); setProvider(""); }} className="min-h-11 w-full rounded-xl border bg-card px-3" disabled={pending}>
              {SERVICE_KINDS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          )}
        </div>
      </div>

      <label className="block space-y-2 text-sm">
        <span>عنوان دقیق خدمت</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={200} required disabled={pending} placeholder="برای نمونه: سی‌تی‌اسکن قفسهٔ سینه" />
      </label>

      <label className="block space-y-2 text-sm">
        <span>مرکز درمانی ارائه‌دهنده</span>
        <select value={provider} onChange={(event) => setProvider(event.target.value)} className="min-h-11 w-full rounded-xl border bg-card px-3" disabled={pending}>
          <option value="">انتخاب مرکز توسط بیمار</option>
          {availableProviders.map((item) => <option key={item.provider_id} value={item.provider_id}>{item.display_name}</option>)}
        </select>
        {!availableProviders.length ? <p className="text-xs text-muted-foreground">در حال حاضر مرکز فعالی برای این خدمت در فهرست نیست؛ بیمار می‌تواند بعداً مرکز را انتخاب کند.</p> : null}
      </label>

      {kind === "physiotherapy" ? (
        <label className="block space-y-2 text-sm">
          <span>تعداد جلسات پیشنهادی</span>
          <Input type="number" min={1} max={100} value={sessions} onChange={(event) => setSessions(event.target.value)} disabled={pending} required />
        </label>
      ) : (
        <label className="block space-y-2 text-sm">
          <span>ناحیهٔ بررسی، اختیاری</span>
          <Input value={bodyRegion} onChange={(event) => setBodyRegion(event.target.value)} maxLength={200} disabled={pending} />
        </label>
      )}

      <JalaliDateTimeField value={scheduled} onChange={setScheduled} label="زمان پیشنهادی، اختیاری" today={today || tehranDayKey()} disabled={pending} />
      <label className="block space-y-2 text-sm">
        <span>توضیحات بالینی</span>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2500} rows={3} disabled={pending} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={pending || !patient || name.trim().length < 2}>ثبت درخواست خدمت</Button>
        <CareFeedback value={feedback} />
      </div>
    </form>
  );
}

export default function MedicalServicesBoard({
  data,
  patients = [],
  today,
  showRequestForm = true,
  showRequests = true,
  defaultPatientId = "",
  title = "درخواست‌ها و گزارش‌های خدمات پزشکی",
  description,
  serviceKind = null,
  collapsibleRequestForm = false,
  collapsibleRequests = false,
}) {
  const requests = Array.isArray(data.requests)
    ? data.requests.filter((request) => !serviceKind || request.service_kind === serviceKind)
    : [];
  const serviceLabel = SERVICE_KINDS.find(([key]) => key === serviceKind)?.[1] || "خدمت پزشکی";
  const requestForm = (
    <MedicalServiceRequestForm
      data={data}
      patients={patients}
      today={today}
      defaultPatientId={defaultPatientId}
      initialKind={serviceKind || "ct"}
      lockKind={Boolean(serviceKind)}
    />
  );
  const requestList = requests.length ? (
    <div className="grid gap-3">
      {requests.map((request) => <MedicalRequestCard key={request.id} request={request} data={data} />)}
    </div>
  ) : (
    <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
      هنوز درخواستی برای {serviceKind ? serviceLabel : "این خدمات پزشکی"} ثبت نشده است.
    </p>
  );

  return (
    <div className="space-y-4">
      {data.user.role === "doctor" && showRequestForm ? (
        collapsibleRequestForm ? (
          <details className="group rounded-xl border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>ثبت درخواست {serviceLabel}</span>
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">باز کردن</span>
              <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">بستن</span>
            </summary>
            <div className="border-t p-3 sm:p-4">{requestForm}</div>
          </details>
        ) : requestForm
      ) : null}

      {showRequests ? (
        collapsibleRequests ? (
          <details className="group rounded-xl border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>{title} <span className="text-muted-foreground">({new Intl.NumberFormat("fa-IR").format(requests.length)})</span></span>
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">نمایش</span>
              <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">بستن</span>
            </summary>
            <div className="space-y-3 border-t p-3 sm:p-4">
              {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
              {requestList}
            </div>
          </details>
        ) : (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
            </div>
            {requestList}
          </section>
        )
      ) : null}
    </div>
  );
}
