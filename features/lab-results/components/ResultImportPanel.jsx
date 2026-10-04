"use client";

import { useRef, useState } from "react";

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeText(value) {
  return normalizeDigits(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function parseClipboardText(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.split(/\t|[,;]/).map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}

function findTestMatch(row, tests) {
  const candidates = row.slice(0, 4).map(normalizeText).filter(Boolean);

  if (!candidates.length) {
    return null;
  }

  return (
    tests.find((test) => {
      const identifiers = [
        test.id,
        test.internal_code,
        test.name,
        test.name_fa,
        test.loinc_code,
      ]
        .map(normalizeText)
        .filter(Boolean);

      return candidates.some((candidate) => identifiers.includes(candidate));
    }) || null
  );
}

function extractValue(row) {
  if (!row?.length) {
    return "";
  }

  const possibleValues = row
    .slice(1)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return possibleValues[0] ?? "";
}

export default function ResultImportPanel({ tests = [], onImport }) {
  const fileInputRef = useRef(null);

  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function applyRows(rows) {
    setError("");
    setMessage("");

    if (!rows.length) {
      setError("داده‌ای برای وارد کردن پیدا نشد.");
      return;
    }

    const imported = [];
    const unknown = [];

    for (const row of rows) {
      const test = findTestMatch(row, tests);
      const value = extractValue(row);

      if (!test) {
        unknown.push(row);
        continue;
      }

      if (!value) {
        unknown.push(row);
        continue;
      }

      imported.push({
        testId: test.id,
        value,
      });
    }

    if (!imported.length) {
      setError("هیچ آزمایش قابل شناسایی در داده واردشده پیدا نشد.");
      return;
    }

    onImport(imported);

    setMessage(
      `${imported.length} نتیجه با موفقیت شناسایی شد${
        unknown.length ? ` و ${unknown.length} مورد شناسایی نشد.` : "."
      }`,
    );
  }

  function handlePasteImport() {
    const rows = parseClipboardText(pasteText);
    applyRows(rows);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPending(true);
    setError("");
    setMessage("");

    try {
      const supported = /\.(csv|tsv|txt)$/i.test(file.name);

      if (!supported) {
        setError(
          "در این نسخه فقط فایل‌های CSV، TSV و TXT پشتیبانی می‌شوند. برای Excel می‌توانید جدول را مستقیماً Copy و Paste کنید.",
        );
        return;
      }

      const text = await file.text();

      const rows = parseClipboardText(text);

      applyRows(rows);
    } catch (importError) {
      console.error("[ResultImportPanel:file]", importError);

      setError("خواندن فایل با خطا مواجه شد.");
    } finally {
      setPending(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-medium">ورود سریع نتایج</h3>

        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          می‌توانید نتایج را مستقیماً از Excel کپی و در کادر زیر Paste کنید، یا
          فایل CSV، TSV یا TXT وارد کنید.
        </p>
      </div>

      <textarea
        value={pasteText}
        onChange={(event) => {
          setPasteText(event.target.value);
          setError("");
          setMessage("");
        }}
        rows={5}
        dir="ltr"
        placeholder={`مثال:
WBC    7.2
HGB    14.8
PLT    250`}
        className="min-h-32 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePasteImport}
          disabled={pending || !pasteText.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          جایگذاری نتایج
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "در حال خواندن..." : "انتخاب فایل"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {message ? (
        <p className="text-sm text-status-normal" role="status">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
