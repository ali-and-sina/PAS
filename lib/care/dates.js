import { PERSIAN_MONTHS } from "./constants";

const DAY = 86400000;
const persian = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});
const tehran = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const partsOf = (formatter, date) => Object.fromEntries(
  formatter.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]),
);
export function faNumber(value) {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
export function tehranDayKey(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const p = partsOf(tehran, date);
  return p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0");
}
export function dayDate(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(key + "T00:00:00.000Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key ? d : null;
}
export function persianParts(key) {
  const d = key instanceof Date ? key : dayDate(key);
  return d ? partsOf(persian, d) : null;
}
export function monthStart(key) {
  const d = key instanceof Date ? key : dayDate(key);
  if (!d) return null;
  const p = persianParts(d);
  return new Date(d.getTime() - (p.day - 1) * DAY).toISOString().slice(0, 10);
}
export function moveMonth(key, direction) {
  const start = dayDate(monthStart(key));
  if (!start) return null;
  return monthStart(new Date(start.getTime() + (direction > 0 ? 32 : -1) * DAY));
}
export function persianMonthKey(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  let key = monthStart(new Date(Date.UTC(year + 621, 2, 21)));
  let p = persianParts(key);
  let distance = (year - p.year) * 12 + month - p.month;
  while (distance) {
    key = moveMonth(key, Math.sign(distance));
    distance -= Math.sign(distance);
  }
  return key;
}
export function monthDays(key) {
  const startKey = monthStart(key);
  const start = dayDate(startKey);
  if (!start) return [];
  const next = dayDate(moveMonth(startKey, 1));
  const length = Math.round((next - start) / DAY);
  const offset = (start.getUTCDay() + 1) % 7;
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length }, (_, i) => ({
      key: new Date(start.getTime() + i * DAY).toISOString().slice(0, 10),
      day: i + 1,
    })),
  ];
}
export function persianDateLabel(key) {
  const p = persianParts(key);
  return p ? faNumber(p.day) + " " + PERSIAN_MONTHS[p.month - 1] + " " + faNumber(p.year) : "انتخاب تاریخ";
}
export function tehranDateTimeToISO(key, time = "00:00") {
  if (!dayDate(key) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const desired = new Date(key + "T" + time + ":00.000Z").getTime();
  let guess = desired;
  for (let i = 0; i < 2; i++) {
    const p = partsOf(tehran, new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += desired - shown;
  }
  return new Date(guess).toISOString();
}
