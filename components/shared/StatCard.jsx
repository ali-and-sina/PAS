import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-primary",
  normal: "bg-status-normal-bg text-status-normal",
  warning: "bg-status-low-bg text-status-low",
  danger: "bg-status-critical-bg text-status-critical",
};
const number = new Intl.NumberFormat("fa-IR");

export default function StatCard({ label, value, icon: Icon, href, tone = "info", detail = "مشاهده موارد", className }) {
  const formatted = typeof value === "number" ? number.format(value) : value ?? "—";
  const content = <Card className={cn("h-full transition-[border-color,box-shadow] group-hover:border-primary/35 group-hover:shadow-sm", className)}>
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="min-h-10 text-xs font-medium leading-5 text-muted-foreground sm:min-h-0 sm:text-sm sm:leading-6">{label}</p><p className="mt-2 text-[2rem] font-bold leading-tight tabular-nums">{formatted}</p></div>
        {Icon && <span className={cn("hidden size-11 shrink-0 items-center justify-center rounded-2xl sm:flex", tones[tone] || tones.info)}><Icon className="size-5" strokeWidth={1.8} aria-hidden="true" /></span>}
      </div>
      {href && <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground"><span className="sm:hidden">مشاهده</span><span className="hidden sm:inline">{detail}</span><ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" /></div>}
    </CardContent>
  </Card>;
  return href ? <Link href={href} className="group block rounded-2xl" aria-label={`${label}، ${formatted}`}>{content}</Link> : content;
}
