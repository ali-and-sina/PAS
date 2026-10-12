"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  confirmPhysicianVisitSummary,
  savePhysicianTranscript,
  savePhysicianVisitSummaryDraft,
} from "@/features/physician-care/actions";

const SUMMARY_FIELDS = [
  { key: "chief_complaint", label: "علت مراجعه", placeholder: "علت اصلی مراجعه بیمار" },
  { key: "history", label: "شرح حال", placeholder: "شرح حال و علائمی که بیمار گزارش کرده است" },
  { key: "exam_findings", label: "یافته‌های ثبت‌شده", placeholder: "یافته‌های عینی ثبت‌شده در ویزیت" },
  { key: "clinical_assessment", label: "ارزیابی پزشک", placeholder: "ارزیابی‌ای که خود پزشک پس از مرور وارد می‌کند" },
  { key: "plan", label: "برنامه", placeholder: "برنامه مراقبت یا اقدام ثبت‌شده توسط پزشک" },
  { key: "follow_up_instructions", label: "دستور پیگیری", placeholder: "تاریخ یا توضیح پیگیری" },
];

function getInitialStructuredContent(visitSummary) {
  const stored = visitSummary?.structured_content;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const hasStructuredText = SUMMARY_FIELDS.some(({ key }) => String(stored[key] || "").trim());
    if (hasStructuredText) return Object.fromEntries(SUMMARY_FIELDS.map(({ key }) => [key, String(stored[key] || "")]));
  }
  const legacySummary = String(visitSummary?.summary || "");
  return Object.fromEntries(SUMMARY_FIELDS.map(({ key }) => [key, key === "clinical_assessment" ? legacySummary : ""]));
}

export default function VoiceNoteClinicalDocumentEditor({ voiceNote }) {
  const voiceNoteId = voiceNote.id;
  const [transcript, setTranscript] = useState(voiceNote.transcript?.transcript_text || "");
  const [summaryFields, setSummaryFields] = useState(() => getInitialStructuredContent(voiceNote.visitSummary));
  const [confirmed, setConfirmed] = useState(Boolean(voiceNote.visitSummary?.doctor_confirmed));
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const hasSummaryContent = SUMMARY_FIELDS.some(({ key }) => summaryFields[key]?.trim());

  function updateSummaryField(key, value) {
    setSummaryFields((current) => ({ ...current, [key]: value }));
  }

  function saveTranscriptClick() {
    setMessage("");
    startTransition(async () => {
      const result = await savePhysicianTranscript({ voiceNoteId, transcriptText: transcript });
      if (!result?.ok) {
        setMessage(result?.message || "ذخیره متن انجام نشد.");
        return;
      }
      setMessage("متن پیاده‌سازی‌شده ذخیره شد.");
    });
  }

  function saveSummaryClick() {
    setMessage("");
    startTransition(async () => {
      const result = await savePhysicianVisitSummaryDraft({ voiceNoteId, structuredContent: summaryFields });
      if (!result?.ok) {
        setMessage(result?.message || "ذخیره پیش‌نویس انجام نشد.");
        return;
      }
      if (result.data?.structured_content) {
        setSummaryFields(getInitialStructuredContent(result.data));
      }
      setConfirmed(false);
      setConfirmationChecked(false);
      setMessage("پیش‌نویس ساختاریافته ذخیره شد و هنوز خلاصه قطعی پرونده نیست.");
    });
  }

  function confirmSummaryClick() {
    setMessage("");
    startTransition(async () => {
      if (!confirmationChecked) {
        setMessage("برای تأیید نهایی، ابتدا گزینه تأیید پزشک را انتخاب کنید.");
        return;
      }

      // Save exactly the text the physician has just reviewed before confirming;
      // otherwise unsaved edits could be mistaken for the stored draft.
      const saved = await savePhysicianVisitSummaryDraft({
        voiceNoteId,
        structuredContent: summaryFields,
      });
      if (!saved?.ok) {
        setMessage(saved?.message || "ذخیره پیش‌نویس پیش از تأیید انجام نشد.");
        return;
      }

      const result = await confirmPhysicianVisitSummary({ voiceNoteId, confirmed: true });
      if (!result?.ok) {
        setMessage(result?.message || "تأیید خلاصه انجام نشد.");
        return;
      }
      if (result.data?.structured_content) {
        setSummaryFields(getInitialStructuredContent(result.data));
      }
      setConfirmed(true);
      setConfirmationChecked(false);
      setMessage("همین نسخهٔ ذخیره‌شده با تأیید صریح پزشک نهایی شد.");
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-xl bg-muted/30 p-4">
        <label htmlFor={`transcript-${voiceNoteId}`} className="text-sm font-medium">متن پیاده‌سازی‌شده</label>
        <textarea
          id={`transcript-${voiceNoteId}`}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          maxLength={10000}
          rows={4}
          className="mt-2 w-full rounded-md border bg-background p-3 text-sm leading-7"
          placeholder="متن پیاده‌سازی‌شده از یادداشت صوتی را وارد کنید..."
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">حداکثر ۱۰٬۰۰۰ نویسه</span>
          <Button type="button" size="sm" variant="outline" onClick={saveTranscriptClick} disabled={pending || !transcript.trim()}>ذخیره متن</Button>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">خلاصه ساختاریافته ویزیت</p>
          <span className={`rounded-full px-2 py-1 text-xs ${confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {confirmed ? "تأییدشده توسط پزشک" : "پیش‌نویس · قطعی نیست"}
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SUMMARY_FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} htmlFor={`${key}-${voiceNoteId}`} className="grid gap-1.5 text-sm">
              <span className="font-medium">{label}</span>
              <textarea
                id={`${key}-${voiceNoteId}`}
                value={summaryFields[key] || ""}
                onChange={(event) => updateSummaryField(key, event.target.value)}
                maxLength={3000}
                rows={3}
                disabled={confirmed}
                className="w-full rounded-md border bg-background p-3 text-sm leading-6 disabled:opacity-70"
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">حداکثر ۳۰۰۰ نویسه برای هر بخش و ۱۰٬۰۰۰ نویسه در مجموع. تا پیش از تأیید صریح پزشک، این داده‌ها پیش‌نویس هستند.</p>
        {!confirmed ? (
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">خلاصه ذخیره‌شده تا زمان تأیید صریح، قطعی محسوب نمی‌شود.</span>
              <Button type="button" size="sm" variant="outline" onClick={saveSummaryClick} disabled={pending || !hasSummaryContent}>ذخیره پیش‌نویس</Button>
            </div>
            <label className="flex items-start gap-2 text-sm leading-6">
              <input type="checkbox" checked={confirmationChecked} onChange={(event) => setConfirmationChecked(event.target.checked)} className="mt-1" />
              متن خلاصه را مرور کرده‌ام و تأیید می‌کنم که این خلاصه می‌تواند به‌عنوان خلاصه تأییدشده ویزیت ثبت شود.
            </label>
            <div><Button type="button" onClick={confirmSummaryClick} disabled={pending || !hasSummaryContent || !confirmationChecked}>تأیید نهایی خلاصه</Button></div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">خلاصه تأییدشده است. تغییر آن از این فرم مجاز نیست؛ برای اصلاح، باید گردش‌کار اصلاح/نسخه‌بندی جداگانه تعریف شود.</p>
        )}
      </section>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
