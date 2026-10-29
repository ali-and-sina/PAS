const months = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const dateParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "Asia/Tehran", year: "numeric", month: "numeric", day: "numeric",
});
const timeParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const digits = value => String(value).replace(/[0-9]/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);

// Compose the label explicitly: server and browser ICU versions may use
// different punctuation/order for dateStyle/timeStyle. Clinical times use
// Tehran consistently rather than the runtime's implicit local timezone.
export function formatPersianDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = Object.fromEntries(dateParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${digits(parts.day)} ${months[Number(parts.month) - 1]} ${digits(parts.year)}`;
}

export function formatPersianDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = Object.fromEntries(timeParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${formatPersianDate(value)}، ساعت ${digits(parts.hour)}:${digits(parts.minute)}`;
}
