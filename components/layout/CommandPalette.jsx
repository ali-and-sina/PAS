"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Search, Settings, X } from "lucide-react";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { getWorkspaceNavigation, NOTIFICATIONS_HREF_BY_ROLE } from "@/lib/constants/navigation";
import { centerSettings } from "@/lib/centers/config";
import { ACCOUNT_PATHS } from "@/lib/care/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .trim();
}

function getQuickLinks(user, navigation) {
  const links = [...navigation];
  const settingsHref = user?.role === "medical_center" || user?.role === "laboratory"
    ? centerSettings(user)
    : ACCOUNT_PATHS[user?.role];

  if (settingsHref && !links.some((item) => item.href === settingsHref)) {
    links.push({ href: settingsHref, label: "تنظیمات حساب", icon: Settings, keywords: "پروفایل حساب تنظیمات" });
  }

  const notificationsHref = NOTIFICATIONS_HREF_BY_ROLE[user?.role];
  if (notificationsHref && !links.some((item) => item.href === notificationsHref)) {
    links.push({ href: notificationsHref, label: "اعلان‌ها", keywords: "پیام اعلان" });
  }

  return links;
}

/** Searchable, keyboard-operable navigation for the current verified workspace. */
export default function CommandPalette({ open, onOpenChange, onOpenShortcuts }) {
  const user = useSessionUser();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const links = useMemo(
    () => getQuickLinks(user, getWorkspaceNavigation(user)),
    [user],
  );
  const filteredLinks = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return links;
    return links.filter((item) => normalize(`${item.label} ${item.href} ${item.keywords || ""}`).includes(needle));
  }, [links, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, filteredLinks.length - 1)));
  }, [filteredLinks.length]);

  function navigateTo(item) {
    if (!item?.href) return;
    onOpenChange(false);
    if (item.href !== pathname) router.push(item.href);
  }

  function handleInputKeyDown(event) {
    if (event.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filteredLinks.length ? (index + 1) % filteredLinks.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (filteredLinks.length ? (index - 1 + filteredLinks.length) % filteredLinks.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigateTo(filteredLinks[activeIndex]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-3 sm:max-w-xl sm:p-4">
        <DialogHeader className="pe-9 text-start">
          <DialogTitle>جستجو و رفتن به بخش‌ها</DialogTitle>
          <DialogDescription>نام بخش یا بخشی از نشانی آن را بنویسید.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="مثلاً بیماران، نسخه‌ها، تنظیمات…"
            aria-label="جستجوی صفحه‌ها"
            role="combobox"
            aria-expanded={open}
            aria-controls="workspace-command-results"
            aria-activedescendant={filteredLinks.length ? `workspace-command-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
            className="pe-10 ps-10"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute start-1 top-1/2 size-9 -translate-y-1/2"
              onClick={() => setQuery("")}
              aria-label="پاک کردن جستجو"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div
          id="workspace-command-results"
          role="listbox"
          aria-label="نتایج جستجوی بخش‌ها"
          className="max-h-[min(52dvh,24rem)] min-h-20 space-y-1 overflow-y-auto overscroll-contain rounded-xl border p-1"
        >
          {filteredLinks.length ? filteredLinks.map((item, index) => {
            const Icon = item.icon || ArrowUpRight;
            const active = index === activeIndex;
            const current = pathname === item.href;
            return (
              <div
                key={item.href}
                id={`workspace-command-option-${index}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateTo(item)}
                className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  <span dir="ltr" className="block truncate text-start text-[0.6875rem] text-muted-foreground">{item.href}</span>
                </span>
                {current ? <span className="text-[0.6875rem] text-muted-foreground">صفحه فعلی</span> : null}
                {active ? <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              </div>
            );
          }) : (
            <div className="flex min-h-24 flex-col items-center justify-center gap-1 px-4 text-center">
              <Search className="size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">بخشی پیدا نشد</p>
              <p className="text-xs text-muted-foreground">عبارت جستجو را کوتاه‌تر یا متفاوت وارد کنید.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span aria-live="polite">{filteredLinks.length.toLocaleString("fa-IR")} نتیجه</span>
          <div className="flex flex-wrap items-center gap-3">
            <span><kbd dir="ltr" className="rounded border bg-muted px-1.5 py-0.5">↑ ↓</kbd> جابه‌جایی</span>
            <span><kbd dir="ltr" className="rounded border bg-muted px-1.5 py-0.5">Enter</kbd> باز کردن</span>
            <button type="button" onClick={() => { onOpenChange(false); onOpenShortcuts(); }} className="min-h-8 rounded-md px-2 font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">راهنمای میانبرها</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
