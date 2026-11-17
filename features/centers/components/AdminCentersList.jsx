"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/shared/SearchInput";
import EmptyState from "@/components/shared/EmptyState";
import { CommandButton } from "@/components/care/ActionControls";
import CenterServiceSummary from "@/features/centers/components/CenterServiceSummary";
import { CENTER_TYPES } from "@/lib/centers/config";

export default function AdminCentersList({ centers = [] }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("fa");
  const filteredCenters = useMemo(() => {
    if (!normalizedQuery) return centers;
    return centers.filter((center) => String(center.display_name || "").toLocaleLowerCase("fa").includes(normalizedQuery));
  }, [centers, normalizedQuery]);

  return (
    <section className="space-y-4" aria-label="فهرست مراکز درمانی">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label htmlFor="admin-center-search" className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
          جست‌وجو در نام مرکز
          <SearchInput
            id="admin-center-search"
            value={draftQuery}
            onValueChange={setDraftQuery}
            onDebouncedChange={setQuery}
            debounceMs={250}
            placeholder="نام مرکز را وارد کنید…"
            aria-label="جست‌وجو در نام مراکز"
          />
        </label>
        <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {filteredCenters.length.toLocaleString("fa-IR")} از {centers.length.toLocaleString("fa-IR")} مرکز
        </p>
      </div>

      {filteredCenters.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCenters.map((center) => {
            const labProfile = center.laboratory_profile;
            const profile = labProfile?.profile;

            return (
              <article key={center.profile_id} className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">{center.display_name}</h2>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {CENTER_TYPES[center.center_type]?.label || "نوع نامشخص"}
                  </span>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">مسئول حساب</dt>
                    <dd className="mt-1">{profile?.full_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">نام کاربری</dt>
                    <dd className="mt-1"><bdi>{profile?.phone || "—"}</bdi></dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">شمارهٔ مجوز</dt>
                    <dd className="mt-1"><bdi>{labProfile?.license_number || "—"}</bdi></dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">وضعیت حساب</dt>
                    <dd className="mt-1">{center.is_active ? "فعال" : "دسترسی متوقف"}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  <CommandButton
                    size="sm"
                    action="center.status"
                    payload={{ id: center.profile_id, is_active: !center.is_active }}
                    confirm={center.is_active ? {
                      title: "توقف دسترسی مرکز؟",
                      description: "دسترسی این مرکز به پنل متوقف می‌شود. درخواست‌ها و سوابق قبلی حذف نمی‌شوند.",
                      confirmLabel: "توقف دسترسی",
                      destructive: true,
                    } : null}
                  >
                    {center.is_active ? "توقف دسترسی مرکز" : "فعال‌کردن دسترسی"}
                  </CommandButton>
                  {center.center_type === "laboratory" ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/laboratories/${center.profile_id}`}>جزئیات آزمایشگاه</Link>
                    </Button>
                  ) : null}
                </div>

                {center.center_type !== "laboratory" ? <CenterServiceSummary centerType={center.center_type} /> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={centers.length ? "مرکزی با این نام پیدا نشد" : "مرکزی برای نمایش ثبت نشده است"}
          description={centers.length ? "عبارت جست‌وجو را کوتاه‌تر کنید یا آن را پاک کنید." : "پس از ثبت مرکز، اطلاعات آن در این قسمت نمایش داده می‌شود."}
        />
      )}
    </section>
  );
}
