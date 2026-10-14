import { Check, CircleDot, FlaskConical, ClipboardList, FileCheck2, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "pending", label: "پذیرش جدید", icon: ClipboardList },
  { key: "received_by_lab", label: "پذیرفته‌شده", icon: Check },
  { key: "in_progress", label: "در حال انجام", icon: FlaskConical },
  { key: "draft", label: "پیش‌نویس نتیجه", icon: PencilLine },
  { key: "completed", label: "تکمیل‌شده", icon: FileCheck2 },
];

const INDEX = new Map(STEPS.map((step, index) => [step.key, index]));

function normalizeStatus(status) {
  if (status === "draft") return "draft";
  return status || "pending";
}

export default function LabWorkflowStrip({ status = "pending" }) {
  const currentIndex = INDEX.get(normalizeStatus(status)) ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">روند پذیرش آزمایش</p>
          <p className="mt-1 text-xs text-muted-foreground">وضعیت پذیرش و نتیجه آزمایش را در یک نگاه دنبال کنید.</p>
        </div>
        <CircleDot className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const done = index <= currentIndex;
          const current = index === currentIndex;

          return (
            <div key={step.key} className="flex min-w-[122px] items-center gap-2">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  done ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground",
                  current && "ring-2 ring-primary/10",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className={cn("text-xs font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
              {index < STEPS.length - 1 ? <span className="hidden h-px flex-1 bg-border md:block" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
