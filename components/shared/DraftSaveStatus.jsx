"use client";

import { CheckCircle2, Cloud, LoaderCircle, AlertCircle } from "lucide-react";

const STATUS = {
  idle: { label: "پیش‌نویس ذخیره نشده است", icon: Cloud, className: "text-muted-foreground" },
  pending: { label: "آمادهٔ ذخیره…", icon: LoaderCircle, className: "text-muted-foreground" },
  saving: { label: "در حال ذخیرهٔ پیش‌نویس…", icon: LoaderCircle, className: "text-muted-foreground" },
  saved: { label: "پیش‌نویس ذخیره شد", icon: CheckCircle2, className: "text-status-normal" },
  error: { label: "ذخیره انجام نشد", icon: AlertCircle, className: "text-destructive" },
};

export default function DraftSaveStatus({ status = "idle", error, lastSavedAt, className = "" }) {
  const current = STATUS[status] || STATUS.idle;
  const Icon = current.icon;
  const label = status === "saved" && lastSavedAt
    ? `${current.label} · ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(lastSavedAt)}`
    : status === "error" && error
      ? error
      : current.label;

  return (
    <p role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"} className={`flex min-h-6 items-center gap-2 text-xs leading-5 ${current.className} ${className}`}>
      <Icon className={`size-4 shrink-0 ${status === "pending" || status === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{label}</span>
    </p>
  );
}
