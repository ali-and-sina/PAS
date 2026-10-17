import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Minus,
  UserRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import DisclosureSection from "@/components/shared/DisclosureSection";
import LabTrendChart from "@/features/physician-care/components/LabTrendChart";
import VoiceVisitNoteRecorder from "@/features/physician-care/components/VoiceVisitNoteRecorder";
import VoiceNoteClinicalDocumentEditor from "@/features/physician-care/components/VoiceNoteClinicalDocumentEditor";
import VisitManager from "@/features/physician-care/components/VisitManager";
import PrivateNoteForm from "@/features/private-notes/components/PrivateNoteForm";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function DirectionIcon({ direction }) {
  if (direction === "up")
    return <ArrowUp className="size-4" aria-hidden="true" />;
  if (direction === "down")
    return <ArrowDown className="size-4" aria-hidden="true" />;
  return <Minus className="size-4" aria-hidden="true" />;
}

function directionClass(direction) {
  // Direction is a numeric comparison only, not a risk or diagnosis signal.
  if (direction === "up" || direction === "down") return "bg-accent text-primary";
  return "bg-muted text-muted-foreground";
}

function valueText(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

export default function PatientSnapshot({ data }) {
  const patient = data.patient;
  const age = getAge(patient.patientProfile?.date_of_birth);
  const latestVisit = data.latestVisit;
  const latestReport = data.latestLab;
  const latestNote = data.latestNote;
  const firstChange = data.changes[0];

  const trendPoints = firstChange
    ? data.labHistory
        .flatMap((report) =>
          report.observations
            .filter(
              (observation) =>
                observation.test_definition_id === firstChange.testId &&
                observation.value_numeric != null,
            )
            .map((observation) => ({
              value: Number(observation.value_numeric),
              date:
                observation.observed_at ||
                report.finalized_at ||
                report.created_at,
            })),
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
              <UserRound className="size-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {patient.full_name || "بیمار"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {age != null ? `${age} سال` : "سن ثبت نشده"}
                {patient.patientProfile?.sex
                  ? ` • ${patient.patientProfile.sex === "male" ? "مرد" : patient.patientProfile.sex === "female" ? "زن" : patient.patientProfile.sex}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">آخرین آزمایش</p>
              <p className="mt-1 font-medium">
                {formatDate(
                  latestReport?.finalized_at || latestReport?.created_at,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">آخرین ویزیت</p>
              <p className="mt-1 font-medium">
                {latestVisit?.visit_date
                  ? formatDate(latestVisit.visit_date)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">گروه خونی</p>
              <p className="mt-1 font-medium">
                {patient.patientProfile?.blood_type || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">رابطه</p>
              <p className="mt-1 font-medium">
                {patient.relationship?.relationship_type === "primary_care"
                  ? "پزشک اصلی"
                  : patient.relationship?.relationship_type === "consulting"
                    ? "پزشک مشاور"
                    : "ارتباط موردی"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <DisclosureSection
        title="پزشکان مرتبط با بیمار"
        description="فقط پزشکان دارای رابطه فعال و تأییدشده نمایش داده می‌شوند."
        meta={`${data.relatedPhysicians?.length ?? 0} پزشک`}
      >
        {data.relatedPhysicians?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.relatedPhysicians.map((physician) => (
              <div key={physician.doctor_id} className="rounded-xl border bg-card p-3">
                <p className="font-medium">{physician.full_name || "پزشک"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {physician.specialty || "تخصص ثبت نشده"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {physician.relationship_type === "primary_care" ? "پزشک اصلی" : physician.relationship_type === "consulting" ? "پزشک مشاور" : "ارتباط موردی"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            پزشک مرتبط دیگری با رابطه فعال ثبت نشده است.
          </p>
        )}
      </DisclosureSection>

      <DisclosureSection
        title="تاریخچه و تغییرات آزمایش‌ها"
        description={`${data.labHistory.length} گزارش نهایی · ${data.changes.length} مورد قابل مقایسه`}
        meta={`${data.labHistory.length} گزارش`}
      >
        <div className="space-y-6">
      <section aria-labelledby="changes-heading">
        <Card>
          <CardHeader>
            <CardTitle id="changes-heading">مهم‌ترین تغییرات</CardTitle>
            <p className="text-sm text-muted-foreground">
              مقایسه داده‌ای نتیجه فعلی با نتیجه قبلی؛ بدون تفسیر تشخیصی.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {data.changes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                هنوز داده کافی برای مقایسه وجود ندارد.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.changes.map((change) => (
                  <div key={change.testId} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{change.testName}</p>
                        {change.testCode ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {change.testCode}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex size-8 items-center justify-center rounded-full ${directionClass(change.direction)}`}
                      >
                        <DirectionIcon direction={change.direction} />
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          قبلی / فعلی
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {valueText(change.previous)} →{" "}
                          {valueText(change.current)}
                        </p>
                      </div>
                      {change.unit ? (
                        <span className="text-xs text-muted-foreground">
                          {change.unit}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {change.change != null ? (
                        <span className="rounded-full bg-muted px-2 py-1 tabular-nums">
                          {change.change > 0 ? "+" : ""}
                          {change.change}
                        </span>
                      ) : null}
                      {change.referenceText ? (
                        <span className="text-muted-foreground">
                          محدوده: {change.referenceText}
                        </span>
                      ) : change.referenceMin != null ||
                        change.referenceMax != null ? (
                        <span className="text-muted-foreground">
                          محدوده: {change.referenceMin ?? "—"} تا{" "}
                          {change.referenceMax ?? "—"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>تاریخچه آزمایش‌ها</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                گزارش‌های نهایی و اصلاح‌شده بیمار.
              </p>
            </div>
            <FileText
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent className="pt-0">
            {data.labHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                هنوز گزارش نهایی برای این بیمار ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {data.labHistory.map((report) => (
                  <div key={report.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">گزارش آزمایش</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(report.finalized_at || report.created_at)}{" "}
                          • {report.laboratoryName}
                        </p>
                      </div>
                      <StatusBadge
                        label={
                          report.status === "amended" ? "اصلاح‌شده" : "نهایی"
                        }
                        variant={
                          report.status === "amended" ? "amended" : "normal"
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {report.observations.slice(0, 6).map((observation) => {
                        const test = Array.isArray(observation.test_definitions)
                          ? observation.test_definitions[0]
                          : observation.test_definitions;
                        const value =
                          observation.value_numeric ??
                          observation.value_text ??
                          (observation.value_boolean == null
                            ? "—"
                            : observation.value_boolean
                              ? "مثبت"
                              : "منفی");
                        return (
                          <div
                            key={observation.id}
                            className="rounded-lg bg-muted/30 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm">
                                {test?.name || "آزمایش"}
                              </span>
                              <span className="font-medium tabular-nums">
                                {value} {observation.unit || ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {report.observations.length > 6 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        + {report.observations.length - 6} مورد دیگر
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>روند آزمایش</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              نمایش یکی از تست‌هایی که بیشترین سابقه را دارد.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {firstChange ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{firstChange.testName}</p>
                    <p className="text-xs text-muted-foreground">
                      {firstChange.unit || "واحد ثبت نشده"}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {valueText(firstChange.current)}
                  </span>
                </div>
                <LabTrendChart points={trendPoints} unit={firstChange.unit} />
              </>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                هنوز روند قابل نمایش نداریم.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

        </div>
      </DisclosureSection>

      <div className="grid gap-6 lg:grid-cols-3">
        <DisclosureSection
          title="پیگیری‌ها"
          description={data.followUps.filter((item) => item.displayStatus === "overdue").length ? `${data.followUps.filter((item) => item.displayStatus === "overdue").length} پیگیری عقب‌افتاده` : "برای مرور و مدیریت پیگیری‌های بیمار، جزئیات را باز کنید."}
          meta={`${data.followUps.length} پیگیری`}
        >
            {data.followUps.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                هنوز پیگیری‌ای برای این بیمار ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {data.followUps.slice(0, 6).map((followUp) => (
                  <div key={followUp.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{followUp.title}</p>
                      <span className={`rounded-full px-2 py-1 text-xs ${followUp.displayStatus === "overdue" ? "bg-status-high-bg text-status-high" : "bg-muted text-muted-foreground"}`}>
                        {followUp.displayStatus === "overdue" ? "عقب‌افتاده" : followUp.status === "pending" ? "در انتظار" : followUp.status === "completed" ? "تکمیل‌شده" : "لغوشده"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">سررسید: {formatDate(followUp.due_date)}</p>
                    {followUp.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{followUp.description}</p> : null}
                  </div>
                ))}
                <Link href="/doctor/follow-ups" className="inline-flex text-xs text-primary hover:underline">مدیریت همه پیگیری‌ها</Link>
              </div>
            )}
        </DisclosureSection>

        <DisclosureSection
          title="ویزیت‌ها"
          description="برای ثبت ویزیت جدید یا به‌روزرسانی وضعیت ویزیت‌های قبلی، جزئیات را باز کنید."
          meta={`${data.visits.length} ویزیت`}
        >
          <VisitManager patientId={patient.id} visits={data.visits} />
        </DisclosureSection>

        <DisclosureSection
          title="یادداشت خصوصی"
          description={latestNote ? "یادداشت خصوصی ثبت شده است؛ برای خواندن یا ثبت یادداشت جدید جزئیات را باز کنید." : "یادداشت خصوصی ثبت نشده است؛ فرم ثبت داخل جزئیات قرار دارد."}
          meta={latestNote ? "ثبت‌شده" : "بدون یادداشت"}
        >
            {latestNote ? (
              <div className="rounded-xl bg-muted/30 p-4 text-sm leading-7">
                {latestNote.content}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                هنوز یادداشت خصوصی ثبت نشده است.
              </div>
            )}
            <div className="mt-4">
              <PrivateNoteForm patientId={patient.id} reportId={latestReport?.id || ""} />
            </div>
        </DisclosureSection>
      </div>

      <DisclosureSection
        title="یادداشت صوتی و ویزیت"
        description="ضبط یادداشت ویزیت و مرور خلاصه‌های صوتی قبلی"
        meta={`${data.voiceNotes.length} یادداشت قبلی`}
      >
        <VoiceVisitNoteRecorder patientId={patient.id} visits={data.visits} />
        {data.voiceNotes.length > 0 ? (
          <div className="space-y-3">
            {data.voiceNotes.map((voiceNote) => (
              <article key={voiceNote.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">یادداشت صوتی ویزیت</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(voiceNote.created_at)} • {Math.round(Number(voiceNote.duration || 0))} ثانیه
                    </p>
                  </div>
                  {voiceNote.visit?.visit_date ? (
                    <span className="text-xs text-muted-foreground">ویزیت: {formatDate(voiceNote.visit.visit_date)}</span>
                  ) : null}
                </div>
                {voiceNote.audioUrl ? (
                  <audio controls preload="none" src={voiceNote.audioUrl} className="mt-4 w-full" />
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">فایل صوتی در حال حاضر در دسترس نیست.</p>
                )}
                <VoiceNoteClinicalDocumentEditor voiceNote={voiceNote} />
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            هنوز یادداشت صوتی قبلی برای این بیمار ثبت نشده است.
          </p>
        )}
      </DisclosureSection>

      <DisclosureSection
        title="روند سلامت بیمار"
        description={data.timeline.length ? `آخرین رویداد: ${data.timeline[0]?.title || "ثبت‌شده"}` : "هنوز رویدادی برای روند سلامت ثبت نشده است."}
        meta={`${data.timeline.length} رویداد`}
      >
          {data.timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              هنوز رویدادی برای روند سلامت ثبت نشده است.
            </div>
          ) : (
            <div className="relative space-y-6 pr-5 before:absolute before:right-1 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {data.timeline.map((event) => (
                <article key={event.id} className="relative">
                  <span
                    className="absolute -right-[4px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary"
                    aria-hidden="true"
                  />
                  <div className="pr-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-medium">{event.title}</h3>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(event.date)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {event.detail}
                    </p>
                    {event.reportId ? (
                      <Link
                        className="mt-2 inline-flex text-xs text-primary hover:underline"
                        href={`/doctor/interpretations?report=${event.reportId}`}
                      >
                        مشاهده گزارش مرتبط
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
      </DisclosureSection>

      <DisclosureSection
        title="نسخه‌های بیمار"
        description={data.prescriptions.length ? "برای مشاهدهٔ داروها، مقدار مصرف و وضعیت هر نسخه، جزئیات را باز کنید." : "نسخه‌ای برای این بیمار ثبت نشده است."}
        meta={`${data.prescriptions.length} نسخه`}
      >
          {data.prescriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              نسخه‌ای برای این بیمار ثبت نشده است.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.prescriptions.map((prescription) => (
                <div key={prescription.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">نسخه</p>
                    <StatusBadge
                      label={
                        prescription.status === "active"
                          ? "فعال"
                          : prescription.status === "completed"
                            ? "تکمیل‌شده"
                            : "لغوشده"
                      }
                      variant={
                        prescription.status === "active"
                          ? "normal"
                          : prescription.status === "completed"
                            ? "neutral"
                            : "neutral"
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(
                      prescription.issued_at || prescription.created_at,
                    )}
                  </p>
                  <div className="mt-4 space-y-2">
                    {prescription.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg bg-muted/30 p-3 text-sm"
                      >
                        <p className="font-medium">{item.medication_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.dosage} • {item.frequency}
                          {item.duration ? ` • ${item.duration}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </DisclosureSection>
    </div>
  );
}
