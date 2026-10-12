import Link from "next/link";
import { ArrowLeft, Beaker, FlaskConical, ListChecks, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    key: "newOrders",
    label: "سفارش جدید",
    icon: Beaker,
    href: "/lab/orders?status=pending",
    accent: "text-primary",
  },
  {
    key: "inProgress",
    label: "در حال انجام",
    icon: FlaskConical,
    href: "/lab/orders?status=in_progress",
    accent: "text-order-in-progress",
  },
  {
    key: "draftReports",
    label: "پیش‌نویس نتیجه",
    icon: PencilLine,
    href: "/lab/results?status=draft",
    accent: "text-muted-foreground",
  },
  {
    key: "readyToFinalize",
    label: "آماده نهایی‌سازی",
    icon: ListChecks,
    href: "/lab/results?status=ready_to_finalize",
    accent: "text-status-normal",
  },
];

export default function LabDashboardStats({ data }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const value = Number(data?.[item.key] || 0);

        return (
          <Link key={item.key} href={item.href} className="group focus-visible:rounded-xl">
            <Card className="h-full transition-colors group-hover:border-primary/30 group-hover:bg-accent/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <Icon className={cn("size-4", item.accent)} aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>مشاهده موارد</span>
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
