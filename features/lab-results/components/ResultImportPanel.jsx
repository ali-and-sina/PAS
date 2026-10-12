"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

function splitLine(line) {
  const parts = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && (char === "," || char === "\t" || char === ";")) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function parseRows(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = splitLine(lines[0]).map((part) => part.toLowerCase());
  const looksLikeHeader =
    first[0] === "test_key" ||
    first[0] === "test" ||
    first[0] === "code" ||
    first[0] === "کد" ||
    first[0] === "آزمایش";

  return lines.slice(looksLikeHeader ? 1 : 0).flatMap((line) => {
    const [testKey, value] = splitLine(line);
    if (!testKey || value == null || value === "") return [];
    return [{ testKey, value }];
  });
}

function normalized(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export default function ResultImportPanel({ tests = [], onImport }) {
  const [rawText, setRawText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const testIndex = useMemo(() => {
    const map = new Map();

    for (const test of tests) {
      const keys = [test.id, test.internal_code, test.name, test.name_fa]
        .map(normalized)
        .filter(Boolean);

      for (const key of keys) {
        const existing = map.get(key);
        if (existing && existing !== test.id) {
          map.set(key, null);
        } else {
          map.set(key, test.id);
        }
      }
    }

    return map;
  }, [tests]);

  function applyRows(rows) {
    if (!rows.length) {
      setError("داده‌ای قابل ورود پیدا نشد.");
      setMessage("");
      return;
    }

    const values = {};
    const unresolved = [];
    const duplicates = [];

    for (const row of rows) {
      const key = normalized(row.testKey);
      const testId = testIndex.get(key);

      if (!testId) {
        unresolved.push(row.testKey);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(values, testId)) {
        duplicates.push(row.testKey);
        continue;
      }

      values[testId] = row.value;
    }

    if (Object.keys(values).length) {
      onImport(values);
    }

    const notes = [];
    if (Object.keys(values).length) notes.push(`${Object.keys(values).length} نتیجه آماده ورود شد.`);
    if (unresolved.length) notes.push(`${unresolved.length} مورد با تست‌های این سفارش تطبیق پیدا نکرد.`);
    if (duplicates.length) notes.push(`${duplicates.length} مورد تکراری نادیده گرفته شد.`);

    setMessage(notes.join(" "));
    setError("");
  }

  function handleTextApply() {
    applyRows(parseRows(rawText));
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setRawText(text);
      applyRows(parseRows(text));
    } catch {
      setError("خواندن فایل انجام نشد.");
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <details className="rounded-xl border bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
        <FileUp className="size-4 text-primary" aria-hidden="true" />
        ورود گروهی نتایج
      </summary>

      <div className="space-y-3 border-t p-4">
        <p className="text-xs leading-5 text-muted-foreground">
          هر ردیف را به شکل <span dir="ltr">کد آزمایش،مقدار</span> یا با جداکنندهٔ تب وارد کنید. تطبیق فقط با آزمایش‌های همین سفارش انجام می‌شود.
        </p>

        <textarea
          value={rawText}
          onChange={(event) => {
            setRawText(event.target.value);
            setMessage("");
            setError("");
          }}
          rows={5}
          placeholder={'کد آزمایش،مقدار\nCHEM-WBC,7.2\nCHEM-HGB,13.4'}
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="داده‌های ورود گروهی"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleTextApply}>
              <Upload className="size-4" aria-hidden="true" />
              اعمال داده‌ها
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={handleFileChange}
              className="sr-only"
              id="lab-result-import-file"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              انتخاب فایل جدولی
            </Button>
          </div>

          {tests.length ? (
            <span className="text-[11px] text-muted-foreground">{tests.length} تست در این سفارش</span>
          ) : null}
        </div>

        {message ? <p className="text-xs leading-5 text-status-normal" role="status">{message}</p> : null}
        {error ? <p className="text-xs leading-5 text-destructive" role="alert">{error}</p> : null}
      </div>
    </details>
  );
}
