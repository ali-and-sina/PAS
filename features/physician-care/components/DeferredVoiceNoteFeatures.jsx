"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const FeatureFallback = () => (
  <div className="min-h-24 animate-pulse rounded-xl bg-muted/30" aria-hidden="true" />
);
const VoiceVisitNoteRecorder = dynamic(
  () => import("./VoiceVisitNoteRecorder"),
  { ssr: false, loading: FeatureFallback },
);
const VoiceNoteClinicalDocumentEditor = dynamic(
  () => import("./VoiceNoteClinicalDocumentEditor"),
  { ssr: false, loading: FeatureFallback },
);

export function DeferredVoiceVisitNoteRecorder({ patientId, visits = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="rounded-xl border p-3"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
        ثبت یادداشت صوتی جدید
      </summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        با بستن این بخش، ضبط جاری متوقف و میکروفون آزاد می‌شود.
      </p>
      <div className="mt-3">
        {isOpen ? <VoiceVisitNoteRecorder patientId={patientId} visits={visits} /> : null}
      </div>
    </details>
  );
}

export function DeferredVoiceNoteClinicalDocumentEditor({ voiceNote }) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <details
      className="mt-3 rounded-xl border px-3"
      onToggle={(event) => {
        if (event.currentTarget.open) setHasOpened(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">
        مشاهده و ویرایش سند بالینی
      </summary>
      <div className="py-3">
        {hasOpened ? <VoiceNoteClinicalDocumentEditor voiceNote={voiceNote} /> : null}
      </div>
    </details>
  );
}
