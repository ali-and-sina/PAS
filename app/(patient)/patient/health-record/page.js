import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ClipboardList,
  FileText,
  LineChart,
  NotebookPen,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import DisclosureSection from "@/components/shared/DisclosureSection";
import { getPatientTimeline } from "@/features/patient/queries";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const EVENT_META = {
  visit: { label: "ویزیت", icon: Stethoscope },
  lab_order: { label: "درخواست آزمایش", icon: ClipboardList },
  lab_result: { label: "نتیجه آزمایش", icon: FileText },
  doctor_explanation: { label: "توضیحات پزشک", icon: NotebookPen },
  prescription: { label: "نسخه", icon: Pill },
  follow_up: { label: "پیگیری", icon: Activity },
  notification: { label: "اعلان", icon: Activity },
};

function formatDate(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

export default async function PatientHealthRecordPage() {
  const timeline = await getPatientTimeline({ limit: 100 });

  const shortcuts = [
    { href: "/patient/results", label: "نتایج آزمایش", icon: FileText },
    { href: "/patient/trends", label: "روند نتایج", icon: LineChart },
    { href: "/patient/interpretations", label: "توضیحات پزشک", icon: NotebookPen },
    { href: "/patient/prescriptions", label: "نسخه‌ها", icon: Pill },
    { href: "/patient/access", label: "دسترسی به پرونده", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="پرونده سلامت"
        description="یک مسیر زمانی از رویدادهای واقعی سلامت شما."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:bg-accent/30"
          >
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{label}</p>
          </Link>
        ))}
      </div>

      <DisclosureSection
        title="روند سلامت"
        description={timeline[0] ? `آخرین رویداد: ${timeline[0].title}` : "ویزیت‌ها، نتایج، نسخه‌ها و پیگیری‌های ثبت‌شده"}
        meta={`${timeline.length} رویداد`}
      >
          {timeline.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="پرونده شما هنوز رویداد قابل نمایش ندارد"
              description="ویزیت‌ها، نتایج، نسخه‌ها و پیگیری‌ها پس از ثبت در سیستم در اینجا کنار هم قرار می‌گیرند."
            />
          ) : (
            <ol className="relative space-y-5 border-s-2 ps-6">
              {timeline.map((event) => {
                const meta = EVENT_META[event.type] ?? EVENT_META.notification;
                const Icon = meta.icon;

                return (
                  <li key={event.id} className="relative">
                    <span className="absolute -start-[39px] top-1 flex size-7 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>

                    <div className="rounded-2xl border p-4 sm:p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                          <h2 className="mt-1 font-semibold">{event.title}</h2>
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {formatDate(event.date)}
                        </time>
                      </div>

                      {event.summary && (
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                          {event.summary}
                        </p>
                      )}

                      {event.type === "lab_result" && event.resource_id && (
                        <Link
                          href={`/patient/results/${event.resource_id}`}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          مشاهده نتیجه
                          <ArrowLeft className="size-4" aria-hidden="true" />
                        </Link>
                      )}

                      {event.type === "follow_up" && (
                        <Link
                          href="/patient/follow-ups"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          مشاهده پیگیری‌ها
                          <ArrowLeft className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
      </DisclosureSection>
    </div>
  );
}
