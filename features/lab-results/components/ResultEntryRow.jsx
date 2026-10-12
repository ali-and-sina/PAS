import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getTestDisplayName } from "@/lib/medical/test-name";
import {
  formatReferenceRange,
  getReferenceSourceLabel,
} from "@/features/lab-results/reference-format";

export default function ResultEntryRow({ test, value = "", onChange }) {
  const label = getTestDisplayName(test);
  const type = test?.value_type === "text" ? "text" : "number";
  const range = formatReferenceRange(test);
  const unit = test?.default_unit || test?.reference_unit || "";
  const sourceLabel = getReferenceSourceLabel(test?.reference_source);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_minmax(210px,0.8fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor={`test-${test.id}`}
              className="text-sm font-semibold"
            >
              {label}
            </Label>
            {test?.is_required ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                الزامی
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                اختیاری
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span dir="ltr">{test?.internal_code || "بدون کد"}</span>
            {unit ? <span> · {unit}</span> : null}
          </p>
        </div>

        {test?.value_type === "boolean" ? (
          <select
            id={`test-${test.id}`}
            name={`value_${test.id}`}
            value={value}
            onChange={(event) => onChange(test.id, event.target.value)}
            required={Boolean(test?.is_required)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">انتخاب نتیجه</option>
            <option value="true">مثبت / بله</option>
            <option value="false">منفی / خیر</option>
          </select>
        ) : (
          <Input
            id={`test-${test.id}`}
            name={`value_${test.id}`}
            type={type}
            inputMode={type === "number" ? "decimal" : "text"}
            step={type === "number" ? "any" : undefined}
            min={
              type === "number" && test?.allows_negative
                ? undefined
                : type === "number"
                  ? 0
                  : undefined
            }
            value={value}
            onChange={(event) => onChange(test.id, event.target.value)}
            required={Boolean(test?.is_required)}
            className="h-10 bg-background"
          />
        )}

        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              محدوده مرجع
            </span>
            {sourceLabel ? (
              <span className="text-[10px] text-muted-foreground">
                {sourceLabel}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 text-xs leading-5",
              range ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {range || "محدوده مرجع برای این آزمایش ثبت نشده است"}
          </p>
        </div>
      </div>
    </div>
  );
}
