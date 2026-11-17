"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, UserRound, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchDoctorPatientsForRecord } from "@/features/patients/actions";

export default function DoctorCalendarPatientPicker({ selectedPatientName = "" }) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [status, setStatus] = useState("idle");
  const requestIdRef = useRef(0);

  useEffect(() => {
    const search = query.trim();
    const requestId = ++requestIdRef.current;
    if (search.length < 2) return undefined;

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchDoctorPatientsForRecord(search);
        if (requestId !== requestIdRef.current) return;
        if (!result?.ok) {
          setPatients([]);
          setStatus("error");
          return;
        }
        setPatients(Array.isArray(result.patients) ? result.patients : []);
        setStatus("success");
      } catch {
        if (requestId !== requestIdRef.current) return;
        setPatients([]);
        setStatus("error");
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [query]);

  function updateQuery(event) {
    const next = event.target.value;
    requestIdRef.current += 1;
    setQuery(next);
    setPatients([]);
    setStatus(next.trim().length >= 2 ? "loading" : "idle");
  }

  function clearSearch() {
    requestIdRef.current += 1;
    setQuery("");
    setPatients([]);
    setStatus("idle");
  }

  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby="doctor-calendar-patient-search-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="doctor-calendar-patient-search-title" className="text-sm font-semibold">جست‌وجوی بیمار در تقویم</h2>
        </div>
        {selectedPatientName ? (
          <p className="text-xs text-muted-foreground">بیمار انتخاب‌شده: <span className="font-medium text-foreground">{selectedPatientName}</span></p>
        ) : null}
      </div>
      <p id="doctor-calendar-patient-search-help" className="mt-2 text-xs leading-5 text-muted-foreground">
        نام، کد ملی یا شمارهٔ موبایل را جست‌وجو کنید؛ فقط بیماران دارای رابطهٔ فعال با شما نمایش داده می‌شوند.
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={updateQuery}
          placeholder="نام، کد ملی یا شمارهٔ موبایل بیمار"
          autoComplete="off"
          aria-label="جست‌وجوی بیمار برای تقویم"
          aria-describedby="doctor-calendar-patient-search-help doctor-calendar-patient-search-status"
          className="pe-10 ps-10"
        />
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute start-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="پاک‌کردن جست‌وجو"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div id="doctor-calendar-patient-search-status" className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
        {status === "loading" ? "در حال جست‌وجو…" : null}
        {status === "error" ? "جست‌وجو انجام نشد؛ دوباره تلاش کنید." : null}
        {status === "idle" && query.trim().length < 2 ? "برای شروع جست‌وجو حداقل دو نویسه وارد کنید." : null}
        {status === "success" && patients.length === 0 ? "بیماری با این مشخصات در فهرست فعال شما پیدا نشد." : null}
      </div>
      {patients.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="نتایج جست‌وجوی بیماران">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                prefetch={false}
                href={`/doctor/calendar?patientId=${encodeURIComponent(patient.id)}`}
                className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate font-medium">{patient.full_name || "بیمار"}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
