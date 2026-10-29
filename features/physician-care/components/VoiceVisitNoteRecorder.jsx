"use client";

import { formatPersianDateTime } from "@/lib/utils/date-time";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Trash2, Upload, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  completePhysicianVoiceNote,
  createVoiceNoteUpload,
} from "@/features/physician-care/voice-actions";

const MIN_SECONDS = 30;
const MAX_SECONDS = 60;

const MIME_OPTIONS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
];

function formatSeconds(value) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  return (
    MIME_OPTIONS.find((mime) => MediaRecorder.isTypeSupported(mime)) || ""
  );
}

function extensionFromMimeType(value) {
  const type = String(value || "").split(";")[0].toLowerCase();
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/mp4") return "m4a";
  if (type === "audio/mpeg") return "mp3";
  return "webm";
}

export default function VoiceVisitNoteRecorder({ patientId, visits = [] }) {
  const activeVisits = useMemo(() => visits.filter((visit) => visit.status !== "cancelled"), [visits]);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState(() =>
    activeVisits.find((visit) => visit.status === "in_progress")?.id ||
    activeVisits.find((visit) => visit.status === "scheduled")?.id ||
    "",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSave = useMemo(
    () =>
      Boolean(audioBlob) &&
      consentConfirmed &&
      seconds >= MIN_SECONDS &&
      seconds <= MAX_SECONDS &&
      !isSaving,
    [audioBlob, consentConfirmed, seconds, isSaving],
  );

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl("");
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [cleanup]);

  function reset() {
    cleanup();
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    setIsRecording(false);
    setIsSaving(false);
    setSeconds(0);
    setAudioBlob(null);
    setError("");
    setSuccess("");
    clearPreview();
  }

  async function startRecording() {
    setError("");
    clearPreview();
    setAudioBlob(null);
    setSeconds(0);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("مرورگر شما امکان ضبط صدا را پشتیبانی نمی‌کند.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = {
        audioBitsPerSecond: 64000,
        ...(mimeType ? { mimeType } : {}),
      };
      const recorder = new MediaRecorder(stream, options);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = performance.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        cleanup();
        setIsRecording(false);
        setError("در زمان ضبط خطایی رخ داد.");
      };

      recorder.onstop = () => {
        const elapsed = startedAtRef.current
          ? Math.min(
              MAX_SECONDS,
              (performance.now() - startedAtRef.current) / 1000,
            )
          : 0;
        const finalSeconds = Number(elapsed.toFixed(1));
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });

        setSeconds(finalSeconds);
        setAudioBlob(blob);
        setIsRecording(false);
        cleanup();

        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      };

      recorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) return;

        const elapsed = (performance.now() - startedAtRef.current) / 1000;
        setSeconds(Math.min(MAX_SECONDS, elapsed));

        if (elapsed >= MAX_SECONDS && recorder.state === "recording") {
          recorder.stop();
        }
      }, 200);
    } catch (recordingError) {
      cleanup();
      setIsRecording(false);
      setError(
        recordingError?.name === "NotAllowedError"
          ? "دسترسی به میکروفون رد شده است. اجازه استفاده از میکروفون را فعال کنید."
          : "دسترسی به میکروفون ممکن نشد.",
      );
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  function discardRecording() {
    reset();
  }

  async function saveRecording() {
    if (!audioBlob || isSaving) return;

    if (seconds < MIN_SECONDS) {
      setError("برای ثبت یادداشت صوتی، حداقل ۳۰ ثانیه ضبط کنید.");
      return;
    }

    if (!consentConfirmed) {
      setError("رضایت بیمار را تأیید کنید.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const mimeType = audioBlob.type || "audio/webm";
      const prepare = await createVoiceNoteUpload({
        patientId,
        duration: Number(seconds.toFixed(2)),
        consentConfirmed: true,
        fileSize: audioBlob.size,
        mimeType,
      });

      if (!prepare?.ok || !prepare.token || !prepare.storagePath) {
        setError(prepare?.message || "آماده‌سازی آپلود انجام نشد.");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("pab-voice-notes")
        .uploadToSignedUrl(
          prepare.storagePath,
          prepare.token,
          audioBlob,
          { contentType: mimeType },
        );

      if (uploadError) {
        setError("آپلود فایل صوتی انجام نشد. دوباره تلاش کنید.");
        return;
      }

      const result = await completePhysicianVoiceNote({
        patientId,
        visitId: selectedVisitId || null,
        voiceNoteId: prepare.voiceNoteId,
        duration: Number(seconds.toFixed(2)),
        storagePath: prepare.storagePath,
        consentConfirmed: true,
      });

      if (!result?.ok) {
        setError(result?.message || "ثبت یادداشت صوتی انجام نشد.");
        return;
      }

      reset();
      setConsentConfirmed(false);
      setSuccess("یادداشت صوتی با موفقیت در پرونده بیمار ثبت شد.");
    } catch (saveError) {
      console.error("[VoiceVisitNoteRecorder]", saveError);
      setError("ثبت یادداشت صوتی انجام نشد. دوباره تلاش کنید.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4" id="voice-note">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                <Mic className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">یادداشت صوتی ویزیت</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  خلاصه کوتاه ویزیت برای اینکه در مراجعه بعدی سریع یادتان بیاید چه اتفاقی افتاده است.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-full border px-4 py-2 text-sm font-medium tabular-nums ${
              isRecording
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "bg-muted/40"
            }`}
            aria-live="polite"
          >
            {formatSeconds(seconds)} / 01:00
          </div>
        </div>

        {activeVisits.length > 0 ? (
          <div className="mt-5 rounded-xl border p-4">
            <label htmlFor={`voice-visit-${patientId}`} className="text-sm font-medium">اتصال یادداشت به ویزیت</label>
            <select
              id={`voice-visit-${patientId}`}
              value={selectedVisitId}
              onChange={(event) => setSelectedVisitId(event.target.value)}
              disabled={isRecording || isSaving}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">ایجاد ویزیت جدید پس از ثبت صدا</option>
              {activeVisits.map((visit) => (
                <option key={visit.id} value={visit.id}>
                  {formatPersianDateTime(visit.visit_date || visit.created_at)} · {visit.status === "scheduled" ? "برنامه‌ریزی‌شده" : visit.status === "in_progress" ? "در حال انجام" : "تکمیل‌شده"}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">با ثبت یادداشت، ویزیت انتخاب‌شده تکمیل می‌شود. ویزیت لغوشده قابل انتخاب نیست.</p>
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-dashed p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(event) => setConsentConfirmed(event.target.checked)}
              disabled={isRecording || isSaving}
              className="mt-1 size-4 rounded border-input"
            />
            <span>تأیید می‌کنم بیمار برای ثبت این یادداشت صوتی رضایت داده است.</span>
          </label>
        </div>

        {error ? (
          <div
            className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-primary"
            role="status"
          >
            {success}
          </div>
        ) : null}

        {isRecording ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={stopRecording} variant="destructive">
              <Square className="size-4" aria-hidden="true" />
              توقف ضبط
            </Button>
            <span className="text-xs text-muted-foreground">
              تا ۶۰ ثانیه، ضبط به‌صورت خودکار متوقف می‌شود.
            </span>
          </div>
        ) : audioBlob ? (
          <div className="mt-5 space-y-4">
            <audio
              controls
              preload="metadata"
              src={previewUrl}
              className="w-full"
            />

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveRecording} disabled={!canSave}>
                <Upload className="size-4" aria-hidden="true" />
                {isSaving ? "در حال ثبت..." : "ثبت در پرونده بیمار"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={discardRecording}
                disabled={isSaving}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                حذف و ضبط دوباره
              </Button>
            </div>

            {seconds < MIN_SECONDS ? (
              <p className="text-xs text-muted-foreground">
                برای ثبت، حداقل ۳۰ ثانیه ضبط لازم است.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={startRecording} disabled={!consentConfirmed}>
              <Mic className="size-4" aria-hidden="true" />
              شروع ضبط
            </Button>
            <span className="text-xs text-muted-foreground">
              بعد از توقف، صدا را قبل از ثبت گوش کنید.
            </span>
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        این یادداشت برای حافظه پزشک است و در این مرحله هیچ تشخیص یا تفسیر خودکار پزشکی از آن تولید نمی‌شود.
      </p>
    </div>
  );
}
