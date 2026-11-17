"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchMedicalServiceProviders } from "@/features/care/actions";

const PAGE_SIZE = 20;

export default function CenterProviderPicker({
  serviceKind,
  initialProviders = [],
  value = "",
  onChange,
  patientRequestsOnly = false,
  disabled = false,
  required = false,
  label = "مرکز درمانی ارائه‌دهنده",
  emptyLabel = "انتخاب مرکز توسط بیمار",
}) {
  const initialItems = useMemo(
    () => (Array.isArray(initialProviders) ? initialProviders : []),
    [initialProviders],
  );
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialItems.length);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const selectedItem = [...initialItems, ...items].find((item) => item.provider_id === value);
  const options = selectedItem && !items.some((item) => item.provider_id === value)
    ? [selectedItem, ...items]
    : items;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function search(nextPage = 1) {
    setLoading(true);
    setFeedback("");
    try {
      const result = await searchMedicalServiceProviders({
        service_kind: serviceKind,
        query,
        page: nextPage,
        page_size: PAGE_SIZE,
        patient_requests_only: patientRequestsOnly,
      });
      if (!result?.ok) {
        setFeedback(result?.message || "جستجوی مراکز انجام نشد.");
        return;
      }
      setItems(Array.isArray(result.data?.items) ? result.data.items : []);
      setTotal(Math.max(0, Number(result.data?.total) || 0));
      setPage(Math.max(1, Number(result.data?.page) || nextPage));
      setSearched(true);
    } catch {
      setFeedback("ارتباط با فهرست مراکز برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-2 text-sm">
        <span>{label}</span>
        <select
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="min-h-11 w-full rounded-xl border bg-card px-3"
          disabled={disabled || loading}
          required={required}
        >
          <option value="">{emptyLabel}</option>
          {options.map((item) => (
            <option key={item.provider_id} value={item.provider_id}>
              {item.display_name}{item.license_number ? ` · ${item.license_number}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
          placeholder="جستجو با نام مرکز یا شمارهٔ مجوز"
          disabled={disabled || loading}
          aria-label="جستجوی مرکز درمانی"
        />
        <Button type="button" variant="outline" onClick={() => search(1)} disabled={disabled || loading}>
          {loading ? "در حال جستجو…" : "جستجوی مراکز"}
        </Button>
      </div>

      {searched ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {new Intl.NumberFormat("fa-IR").format(total)} مرکز منطبق · صفحهٔ {new Intl.NumberFormat("fa-IR").format(page)} از {new Intl.NumberFormat("fa-IR").format(pageCount)}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={loading || page <= 1} onClick={() => search(page - 1)}>
              قبلی
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={loading || page >= pageCount} onClick={() => search(page + 1)}>
              بعدی
            </Button>
          </div>
        </div>
      ) : null}

      {searched && !items.length ? (
        <p className="text-xs text-muted-foreground">مرکزی با این مشخصات پیدا نشد.</p>
      ) : null}
      {feedback ? <p role="status" className="text-xs text-destructive">{feedback}</p> : null}
    </div>
  );
}
