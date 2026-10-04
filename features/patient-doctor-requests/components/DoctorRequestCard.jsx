"use client";

import { useActionState } from "react";
import { UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";

const initialState = {
  ok: false,
  message: "",
  status: "pending",
};

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status) {
  switch (status) {
    case "active":
      return "تأیید شده";
    case "inactive":
      return "رد شده";
    default:
      return "در انتظار تأیید";
  }
}

function statusClasses(status) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export default function DoctorRequestCard({
  request,
  acceptAction,
  rejectAction,
}) {
  const [acceptState, acceptFormAction, accepting] = useActionState(
    acceptAction,
    initialState,
  );

  const [rejectState, rejectFormAction, rejecting] = useActionState(
    rejectAction,
    initialState,
  );

  const currentStatus =
    acceptState.status !== "pending"
      ? acceptState.status
      : rejectState.status !== "pending"
        ? rejectState.status
        : request.status;

  const feedback = acceptState.message || rejectState.message;
  const doctor = request.doctor || {};
  const pending = accepting || rejecting;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              {doctor.full_name
                ? `دکتر ${doctor.full_name}`
                : "پزشک"}
            </h2>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                currentStatus,
              )}`}
            >
              {statusLabel(currentStatus)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {doctor.specialty ? (
              <span>{doctor.specialty}</span>
            ) : null}

            {doctor.medical_license_number ? (
              <span dir="ltr">
                کد نظام پزشکی: {doctor.medical_license_number}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            این پزشک درخواست برقراری ارتباط با پرونده پزشکی شما را ارسال کرده
            است. پس از تأیید، پزشک می‌تواند فقط به اطلاعاتی دسترسی داشته باشد
            که مجوزهای سامانه برای رابطه فعال اجازه می‌دهند.
          </p>

          <time className="mt-3 block text-xs text-slate-400">
            زمان درخواست: {formatDate(request.created_at)}
          </time>
        </div>

        {currentStatus === "pending" ? (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-36">
            <form action={acceptFormAction}>
              <input
                type="hidden"
                name="relationship_id"
                value={request.id}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={pending}
              >
                <UserCheck aria-hidden="true" />
                {accepting ? "در حال تأیید..." : "تأیید درخواست"}
              </Button>
            </form>

            <form action={rejectFormAction}>
              <input
                type="hidden"
                name="relationship_id"
                value={request.id}
              />

              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={pending}
              >
                <UserX aria-hidden="true" />
                {rejecting ? "در حال رد..." : "رد درخواست"}
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            acceptState.ok || rejectState.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={
            acceptState.ok || rejectState.ok
              ? "status"
              : "alert"
          }
        >
          {feedback}
        </p>
      ) : null}
    </article>
  );
}
