import Link from "next/link";
import {
  Activity,
  FileText,
  FlaskConical,
  HeartPulse,
  Scan,
  Stethoscope,
} from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import LabOrderForm from "@/features/lab-orders/components/LabOrderForm";
import PatientLabRequestCard from "@/features/lab-dispatch/components/PatientLabRequestCard";
import MedicalServicesBoard from "@/features/care/components/MedicalServicesBoard";
import { SERVICE_KINDS } from "@/lib/care/constants";

const DOCTOR_LAB_STATUS = {
  submitted: "در انتظار اقدام بیمار",
  cancelled: "لغوشده",
  fulfilled: "انجام‌شده",
};
const OPERATIONAL_LAB_STATUS = {
  pending: "در انتظار شروع کار",
  received_by_lab: "پذیرفته‌شده توسط مرکز",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function SectionHeading({ title, description, id }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function DoctorLabRequests({ requests }) {
  if (!requests.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">درخواستی برای آزمایش ثبت نشده است.</p>;
  }

  return (
    <div className="grid gap-3">
      {requests.map((request) => {
        const latest = request.dispatches?.[0];
        return (
          <article key={request.id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{request.patient_name || "بیمار"}</p>
                <p className="mt-1 text-xs text-muted-foreground">ثبت درخواست: {formatDate(request.created_at, true)}</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">{DOCTOR_LAB_STATUS[request.status] || request.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(request.items || []).map((item) => (
                <span key={item.id} className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                  {item.panel?.name_fa || item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"}
                </span>
              ))}
            </div>
            {latest ? (
              <p className="text-sm text-muted-foreground">
                آخرین پیگیری: {latest.branch?.display_name || "مرکز مشخص نشده"} · {latest.status === "accepted" ? "پذیرفته‌شده" : latest.status === "rejected" ? "پذیرفته‌نشده" : latest.status === "cancelled" ? "لغوشده" : "در انتظار پاسخ"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">بیمار هنوز مرکز آزمایش را انتخاب نکرده است.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">{request.clinical_note || "یادداشت بالینی ثبت نشده است."}</span>
              <Button asChild variant="outline" size="sm"><Link href={`/doctor/lab-orders/${request.id}`}>جزئیات درخواست</Link></Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DoctorOperationalOrders({ orders }) {
  if (!orders.length) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">هنوز درخواستی از سوی مرکز پذیرفته نشده است.</p>;
  }
  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <article key={order.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">{order.patient_name || "بیمار"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{order.laboratory_name || "مرکز آزمایش"} · {formatDate(order.ordered_at, true)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{OPERATIONAL_LAB_STATUS[order.status] || order.status} · {order.test_count || 0} مورد آزمایش</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link href={`/doctor/lab-orders/${order.id}`}>مشاهده جزئیات</Link></Button>
        </article>
      ))}
    </div>
  );
}

function PatientLabResults({ reports }) {
  if (!reports.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">هنوز نتیجهٔ نهایی آزمایشی برای شما ثبت نشده است. پس از نهایی‌شدن گزارش، آن را همین‌جا می‌بینید.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reports.map((report) => (
        <Link key={report.id} href={`/patient/results/${report.id}`} className="group rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><FileText className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-medium">گزارش آزمایش</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(report.finalized_at || report.created_at)}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs">{report.status === "amended" ? "اصلاح‌شده" : "نهایی"}</span>
          </div>
          <p className="mt-3 text-sm text-primary group-hover:underline">مشاهدهٔ نتیجه</p>
        </Link>
      ))}
    </div>
  );
}

function DoctorLabResults({ reports }) {
  if (!reports.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">هنوز گزارش نهایی آزمایشی برای بیماران شما ثبت نشده است.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reports.slice(0, 12).map((report) => (
        <article key={report.id} className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="font-medium">{report.patient_name || "بیمار"}</p>
            <p className="mt-1 text-xs text-muted-foreground">نتیجهٔ نهایی آزمایش · {formatDate(report.finalized_at || report.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {report.patient_id ? <Button asChild variant="outline" size="sm"><Link href={`/doctor/patients/${report.patient_id}`}>پروندهٔ بیمار</Link></Button> : null}
            <Button asChild size="sm"><Link href={`/doctor/interpretations?report=${report.id}`}>بررسی و تفسیر</Link></Button>
          </div>
        </article>
      ))}
    </div>
  );
}

const SERVICE_DESCRIPTIONS = {
  laboratory: "ثبت درخواست آزمایش، انتخاب مرکز و مشاهدهٔ جواب‌ها",
  ct: "درخواست و گزارش سی‌تی‌اسکن",
  mri: "درخواست و گزارش ام‌آر‌آی",
  ecg: "نوار قلب و گزارش تخصصی",
  ultrasound: "درخواست و گزارش سونوگرافی",
  mammography: "ماموگرافی و گزارش مرکز",
  xray: "رادیوگرافی و گزارش تصویربرداری",
  physiotherapy: "دوره و جلسات فیزیوتراپی",
  other: "دیگر خدمات تشخیصی و درمانی",
};

function getServiceIcon(kind) {
  if (kind === "laboratory") return FlaskConical;
  if (kind === "ecg") return HeartPulse;
  if (kind === "physiotherapy") return Activity;
  if (kind === "other") return Stethoscope;
  return Scan;
}

function ServiceOverviewCard({ id, title, description, count, detail, icon: Icon, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24 flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-heading`} className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y py-3">
        <span className="text-sm font-semibold tabular-nums">{new Intl.NumberFormat("fa-IR").format(count)} درخواست</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}

export default function MedicalCentersWorkspace({
  role,
  medicalData,
  patients = [],
  labRequests,
  labOrders,
  labResults = [],
  branches = [],
  testPanels = [],
  testDefinitions = [],
  today,
  defaultPatientId = "",
}) {
  const isDoctor = role === "doctor";
  const isPatient = role === "patient";
  const requests = labRequests?.items || [];
  const patientReports = labResults?.items || [];
  const doctorReports = Array.isArray(labResults) ? labResults : [];
  const medicalRequests = medicalData?.requests || [];
  const laboratoryRequestCount = labRequests?.pagination?.totalCount ?? requests.length;
  const laboratoryResultCount = labResults?.pagination?.totalCount ?? doctorReports.length;

  const orderedServiceKinds = [
    ...SERVICE_KINDS.slice(0, 4),
    ["laboratory", "آزمایش‌های آزمایشگاهی"],
    ...SERVICE_KINDS.slice(4),
  ];
  const serviceOverview = orderedServiceKinds.map(([key, title]) => {
    if (key === "laboratory") {
      return {
        key,
        title,
        description: SERVICE_DESCRIPTIONS.laboratory,
        count: laboratoryRequestCount,
        detail: `${new Intl.NumberFormat("fa-IR").format(laboratoryResultCount)} گزارش نهایی`,
        icon: getServiceIcon("laboratory"),
      };
    }

    const serviceRequests = medicalRequests.filter((request) => request.service_kind === key);
    const reportCount = serviceRequests.reduce(
      (total, request) => total + (request.pas_medical_results?.length || 0),
      0,
    );
    return {
      key,
      title,
      description: SERVICE_DESCRIPTIONS[key] || "درخواست و گزارش خدمت پزشکی",
      count: serviceRequests.length,
      detail: `${new Intl.NumberFormat("fa-IR").format(reportCount)} گزارش مرکز`,
      icon: getServiceIcon(key),
    };
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="همهٔ حوزه‌های خدمات مراکز درمانی"
        description="آزمایش، تصویربرداری و خدمات درمانی در کارت‌های مستقل و هم‌سطح قرار گرفته‌اند. برای ثبت درخواست یا پیگیری گزارش، حوزهٔ مربوط را باز کنید."
      />

      <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {serviceOverview.map((service) => {
          if (service.key !== "laboratory") {
            return (
              <ServiceOverviewCard
                key={service.key}
                id={`service-${service.key}`}
                title={service.title}
                description={service.description}
                count={service.count}
                detail={service.detail}
                icon={service.icon}
              >
                <MedicalServicesBoard
                  data={medicalData}
                  patients={patients}
                  today={today}
                  defaultPatientId={defaultPatientId}
                  serviceKind={service.key}
                  showRequestForm={isDoctor}
                  showRequests
                  collapsibleRequestForm
                  collapsibleRequests
                  title={`درخواست‌ها و گزارش‌های ${service.title}`}
                  description={`درخواست‌های ${service.title} و گزارش‌هایی که مرکز درمانی برای آن ثبت کرده است.`}
                />
              </ServiceOverviewCard>
            );
          }

          return (
            <ServiceOverviewCard
              key={service.key}
              id="service-laboratory"
              title={service.title}
              description={service.description}
              count={service.count}
              detail={service.detail}
              icon={service.icon}
            >
              {isDoctor ? (
                <details className="group rounded-xl border">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span>ثبت درخواست آزمایش برای بیمار</span>
                    <span className="text-xs font-normal text-muted-foreground group-open:hidden">باز کردن</span>
                    <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">بستن</span>
                  </summary>
                  <div className="border-t p-3 sm:p-4">
                    {testPanels.length || testDefinitions.length ? (
                      <LabOrderForm
                        key={defaultPatientId || "all-patients"}
                        patients={patients}
                        defaultPatientId={defaultPatientId}
                        testPanels={testPanels}
                        testDefinitions={testDefinitions}
                        redirectTo="/doctor/medical-services"
                      />
                    ) : (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">کاتالوگ آزمایش‌ها هنوز مورد فعالی ندارد.</p>
                    )}
                  </div>
                </details>
              ) : null}

              <details className="group rounded-xl border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span>درخواست‌ها و جواب‌های آزمایش</span>
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">نمایش</span>
                  <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">بستن</span>
                </summary>
                <div className="space-y-4 border-t p-3 sm:p-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">{isPatient ? "درخواست‌های آزمایش شما" : "درخواست‌های آزمایش بیماران"}</h4>
                    {isPatient ? (
                      requests.length ? (
                        <div className="grid gap-3">{requests.map((request) => <PatientLabRequestCard key={request.id} request={request} branches={branches} />)}</div>
                      ) : (
                        <EmptyState icon={FlaskConical} title="درخواست آزمایشی ثبت نشده است" description="در صورت ثبت درخواست آزمایش توسط پزشک، برای انتخاب مرکز و پیگیری آن به این بخش مراجعه کنید." />
                      )
                    ) : (
                      <DoctorLabRequests requests={requests} />
                    )}
                    {labRequests?.pagination ? (
                      <Pagination
                        pathname={isPatient ? "/patient/medical-services" : "/doctor/medical-services"}
                        page={labRequests.pagination.page}
                        pageSize={labRequests.pagination.pageSize}
                        totalCount={labRequests.pagination.totalCount}
                        totalPages={labRequests.pagination.totalPages}
                        pageParam="labRequestsPage"
                        query={isPatient
                          ? { labResultsPage: labResults?.pagination?.page > 1 ? labResults.pagination.page : undefined }
                          : { labOrdersPage: labOrders?.pagination?.page > 1 ? labOrders.pagination.page : undefined }}
                      />
                    ) : null}
                  </div>

                  {isDoctor ? (
                    <>
                      <div className="space-y-3 border-t pt-4">
                        <h4 className="text-sm font-semibold">پذیرش‌های مراکز و آزمایش‌های در حال انجام</h4>
                        <DoctorOperationalOrders orders={labOrders?.items || []} />
                        {labOrders?.pagination ? (
                          <Pagination
                            pathname="/doctor/medical-services"
                            page={labOrders.pagination.page}
                            pageSize={labOrders.pagination.pageSize}
                            totalCount={labOrders.pagination.totalCount}
                            totalPages={labOrders.pagination.totalPages}
                            pageParam="labOrdersPage"
                            query={{ labRequestsPage: labRequests?.pagination?.page > 1 ? labRequests.pagination.page : undefined }}
                          />
                        ) : null}
                      </div>
                      <div className="space-y-3 border-t pt-4">
                        <h4 className="text-sm font-semibold">نتایج نهایی آزمایش بیماران</h4>
                        <DoctorLabResults reports={doctorReports} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3 border-t pt-4">
                      <h4 className="text-sm font-semibold">نتایج نهایی آزمایش شما</h4>
                      <PatientLabResults reports={patientReports} />
                      {labResults?.pagination ? (
                        <Pagination
                          pathname="/patient/medical-services"
                          page={labResults.pagination.page}
                          pageSize={labResults.pagination.pageSize}
                          totalCount={labResults.pagination.totalCount}
                          totalPages={labResults.pagination.totalPages}
                          pageParam="labResultsPage"
                          query={{ labRequestsPage: labRequests?.pagination?.page > 1 ? labRequests.pagination.page : undefined }}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              </details>
            </ServiceOverviewCard>
          );
        })}
      </div>
    </div>
  );
}
