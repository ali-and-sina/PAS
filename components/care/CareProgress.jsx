import { RECORD_SCOPES } from "@/lib/care/constants";
import { faNumber } from "@/lib/care/dates";

export default function CareProgress({ progress }) {
  const total = Math.max(0, Number(progress?.total) || 0);
  const done = Math.min(total, Math.max(0, Number(progress?.completed) || 0));
  const percent = total ? Math.round(done / total * 100) : null;
  const color = percent === null ? "#94a3b8" : percent >= 80 ? "#059669" : percent >= 40 ? "#d97706" : "#dc2626";
  return <section className="rounded-2xl border bg-card p-5" aria-label="میزان انجام پیگیری‌های درمان">
    <h2 className="font-semibold">میزان انجام پیگیری‌های درمان</h2>
    <div className="mt-5 flex items-center gap-5">
      <div className="flex shrink-0 flex-col items-center gap-2" {...(percent === null ? {} : { role: "meter", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-label": "درصد پیگیری‌های انجام‌شده" })}>
        <div aria-hidden="true" className="relative h-40 w-14 overflow-hidden rounded-full border-4 border-card bg-muted shadow-inner"><div className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: (percent || 0) + "%", backgroundColor: color }} /></div>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{percent === null ? "—" : faNumber(percent) + "٪"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-7">{total ? faNumber(done) + " کار از " + faNumber(total) + " کار انجام شده است." : "هنوز پیگیری قابل محاسبه‌ای ثبت نشده است."}</p>
        <ul className="mt-3 space-y-2">{(progress?.sections || []).map((section) => <li key={section.kind} className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{RECORD_SCOPES.find(([key]) => key === section.kind)?.[1] || section.kind}</span><span>{faNumber(section.completed)} از {faNumber(section.total)}</span></li>)}</ul>
      </div>
    </div>
    <p className="mt-4 text-xs leading-6 text-muted-foreground">کارهای باز و کارهای انجام‌شده در ۹۰ روز گذشته در بخش‌های قابل مشاهده؛ برنامه‌های آینده شمرده نمی‌شوند. این عدد میزان انجام پیگیری‌ها را نشان می‌دهد.</p>
  </section>;
}
