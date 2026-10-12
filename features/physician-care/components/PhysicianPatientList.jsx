"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("fa");
}

function getAge(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export default function PhysicianPatientList({ patients = [] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return patients;

    return patients.filter((patient) =>
      [patient.full_name, patient.national_id, patient.phone]
        .map(normalize)
        .some((value) => value.includes(term)),
    );
  }, [patients, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجوی نام، کد ملی یا موبایل"
          aria-label="جست‌وجوی بیماران"
          className="pr-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <UserRound className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">بیماری با این مشخصات پیدا نشد.</p>
          <p className="mt-1 text-sm text-muted-foreground">عبارت جست‌وجو را تغییر دهید.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="p-4 text-right font-medium">بیمار</th>
                  <th className="p-4 text-right font-medium">سن</th>
                  <th className="p-4 text-right font-medium">کد ملی</th>
                  <th className="p-4 text-right font-medium">موبایل</th>
                  <th className="p-4 text-right font-medium">پرونده</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => {
                  const age = getAge(patient.patientProfile?.date_of_birth);
                  return (
                    <tr key={patient.id} className="border-b last:border-0">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
                            <UserRound className="size-4" aria-hidden="true" />
                          </span>
                          <span className="font-medium">{patient.full_name || "بدون نام"}</span>
                        </div>
                      </td>
                      <td className="p-4">{age != null ? `${age} سال` : "—"}</td>
                      <td className="p-4 tabular-nums">{patient.national_id || "—"}</td>
                      <td className="p-4 tabular-nums" dir="ltr">{patient.phone || "—"}</td>
                      <td className="p-4">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/doctor/patients/${patient.id}`}>مشاهده پرونده</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{filtered.length} بیمار از {patients.length} بیمار فعال</p>
    </div>
  );
}
