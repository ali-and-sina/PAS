"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { faNumber, monthStart, moveMonth, monthDays, persianParts, persianMonthKey, persianDateLabel, tehranDayKey, tehranDateTimeToISO } from "@/lib/care/dates";
import { PERSIAN_MONTHS } from "@/lib/care/constants";
import { loadCalendarEvents } from "@/features/care/actions";

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export function CalendarMonth({ month, onMonthChange, onSelect, selected, today, events = [], pending = false, min, max, yearRange }) {
  const headingId = useId();
  const p = persianParts(month);
  const byDay = new Map();
  for (const event of events) byDay.set(event.day, (byDay.get(event.day) || 0) + 1);
  const years = yearRange ? Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[1] - i) : null;
  return <div dir="rtl" className="min-w-0 space-y-3" aria-busy={pending}>
    <div className="flex items-center justify-between gap-2">
      <Button type="button" size="icon" variant="ghost" aria-label="ماه قبل" disabled={pending} onClick={() => onMonthChange(moveMonth(month, -1))}><ChevronRight aria-hidden="true" /></Button>
      {years ? <div className="flex min-w-0 gap-1">
        <select aria-label="ماه شمسی" value={p.month} disabled={pending} className="min-h-11 rounded-lg border bg-card px-2 text-sm" onChange={(e) => onMonthChange(persianMonthKey(p.year, Number(e.target.value)))}>{PERSIAN_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select>
        <select aria-label="سال شمسی" value={p.year} disabled={pending} className="min-h-11 rounded-lg border bg-card px-2 text-sm" onChange={(e) => onMonthChange(persianMonthKey(Number(e.target.value), p.month))}>{years.map((year) => <option key={year} value={year}>{faNumber(year)}</option>)}</select>
      </div> : <h3 id={headingId} className="font-semibold" aria-live="polite">{PERSIAN_MONTHS[p.month - 1]} {faNumber(p.year)}</h3>}
      <Button type="button" size="icon" variant="ghost" aria-label="ماه بعد" disabled={pending} onClick={() => onMonthChange(moveMonth(month, 1))}><ChevronLeft aria-hidden="true" /></Button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{WEEKDAYS.map((name, i) => <abbr key={i} title={WEEKDAY_NAMES[i]} className="py-2 no-underline">{name}</abbr>)}</div>
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={PERSIAN_MONTHS[p.month - 1] + " " + faNumber(p.year)}>
      {monthDays(month).map((day, i) => !day ? <span key={"blank" + i} /> : <button key={day.key} type="button"
        disabled={pending || Boolean(min && day.key < min) || Boolean(max && day.key > max)}
        onClick={() => onSelect(day.key)} aria-current={day.key === today ? "date" : undefined}
        aria-pressed={selected === day.key}
        aria-label={persianDateLabel(day.key) + (byDay.get(day.key) ? "، " + faNumber(byDay.get(day.key)) + " رویداد" : "")}
        className={"relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl border text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35 " +
          (selected === day.key ? "border-primary bg-primary text-primary-foreground" : day.key === today ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted")}>
        {faNumber(day.day)}
        {byDay.has(day.key) && <span aria-hidden="true" className={"mt-0.5 size-1 rounded-full " + (selected === day.key ? "bg-primary-foreground" : "bg-primary")} />}
      </button>)}
    </div>
  </div>;
}
export function HealthCalendar({ patientId, initialMonth, initialEvents = [], today }) {
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedEvents = events.filter((event) => event.day === selected);
  function changeMonth(value) {
    setError("");
    startTransition(async () => {
      try {
        const result = await loadCalendarEvents({ patientId, from: value, to: moveMonth(value, 1) });
        if (!result.ok) return setError(result.message);
        setMonth(value);
        setEvents(result.events);
        setSelected(null);
      } catch { setError("رویدادهای ماه دریافت نشدند."); }
    });
  }
  return <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5" aria-label="تقویم شمسی پرونده">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">تقویم پرونده</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">روزهای دارای نقطه، رویداد ثبت‌شده دارند.</p></div><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => changeMonth(monthStart(today))}>امروز</Button></div>
    <CalendarMonth month={month} today={today} events={events} selected={selected} onSelect={setSelected} onMonthChange={changeMonth} pending={pending} />
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent dir="rtl" className="max-h-[85dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-2xl text-start">
        <DialogTitle className="pe-7">{selected ? persianDateLabel(selected) : "رویدادها"}</DialogTitle>
        <DialogDescription className="text-start">{faNumber(selectedEvents.length)} رویداد در پروندهٔ قابل مشاهده</DialogDescription>
        {selectedEvents.length ? <ul className="space-y-3">{selectedEvents.map((event) => <li key={event.id} className="rounded-xl border p-4"><h3 className="font-semibold">{event.title}</h3>{event.summary && <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{event.summary}</p>}{event.href && <Link href={event.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">مشاهدهٔ جزئیات</Link>}</li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">برای این روز رویدادی ثبت نشده است.</p>}
      </DialogContent>
    </Dialog>
  </section>;
}
export function JalaliDateField({ id, name, value = "", onChange, label = "تاریخ", required = false, max, min, disabled = false, birthDate = false, today, buttonRef, invalid, describedBy }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const base = today || tehranDayKey();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthStart(dayDateSafe(value) ? value : base));
  const year = persianParts(base).year;
  return <div className="min-w-0 space-y-2">
    <label htmlFor={fieldId} className="block text-sm font-medium">{label}{required ? " *" : ""}</label>
    {name && <input type="hidden" name={name} value={value} />}
    <Button id={fieldId} ref={buttonRef} aria-invalid={invalid || undefined} aria-describedby={describedBy} type="button" variant="outline" disabled={disabled} aria-haspopup="dialog" className="w-full justify-between font-normal" onClick={() => { setMonth(monthStart(dayDateSafe(value) ? value : base)); setOpen(true); }}><span>{value ? persianDateLabel(value) : "انتخاب تاریخ شمسی"}</span><CalendarDays className="size-4" aria-hidden="true" /></Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="w-[calc(100%_-_2rem)] max-w-sm rounded-2xl p-4">
        <DialogTitle className="pe-7 text-start">{label}</DialogTitle>
        <DialogDescription className="text-start">تاریخ را از تقویم شمسی انتخاب کنید.</DialogDescription>
        <CalendarMonth month={month} onMonthChange={setMonth} today={base} selected={value} min={min} max={max || (birthDate ? base : undefined)} yearRange={birthDate ? [year - 150, year] : [year - 3, year + 5]} onSelect={(key) => { onChange(key); setOpen(false); }} />
      </DialogContent>
    </Dialog>
  </div>;
}
function dayDateSafe(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value); }
export function JalaliDateTimeField({ value, onChange, label, today, required, disabled }) {
  const dateKey = value ? tehranDayKey(value) : "";
  const time = value ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) : "12:00";
  return <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_110px]">
    <JalaliDateField value={dateKey} today={today} onChange={(key) => onChange(tehranDateTimeToISO(key, time))} label={label} required={required} disabled={disabled} />
    <label className="block space-y-2 text-sm font-medium"><span>ساعت تهران</span><input aria-label="ساعت تهران" type="time" value={time} disabled={disabled} className="h-11 w-full rounded-xl border bg-card px-3" onChange={(event) => { if (event.target.value && dateKey) onChange(tehranDateTimeToISO(dateKey, event.target.value)); }} /></label>
  </div>;
}
