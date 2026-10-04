import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveReferenceRange } from "@/lib/lab/reference-ranges";

export default function ResultEntryRow({
  test,
  value = "",
  onChange,
}) {
  const label = test?.name_fa || test?.name || "آزمایش";
  const type = test?.value_type === "text" ? "text" : "number";
  const referenceRange = resolveReferenceRange(test);

  return (
    <div className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_240px_minmax(220px,0.8fr)] lg:items-center">
      <div className="min-w-0">
        <Label htmlFor={`test-${test.id}`}>
          {label}
        </Label>

        <p className="mt-1 text-xs text-muted-foreground">
          {test?.internal_code || "بدون کد"}
          {test?.default_unit
            ? ` · ${test.default_unit}`
            : ""}
        </p>
      </div>

      {test?.value_type === "boolean" ? (
        <select
          id={`test-${test.id}`}
          name={`value_${test.id}`}
          value={value}
          onChange={(event) =>
            onChange(test.id, event.target.value)
          }
          required
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          value={value}
          onChange={(event) =>
            onChange(test.id, event.target.value)
          }
          required
        />
      )}

      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5">
        <div className="font-medium">
          رنج مرجع
        </div>
        <div className="mt-0.5 text-muted-foreground">
          {referenceRange?.text ||
            "طبق رنج آزمایشگاه"}
        </div>
        {referenceRange?.source === "placeholder" ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            این مقدار موقت است و بعداً با رنج آزمایشگاه جایگزین می‌شود.
          </div>
        ) : null}
      </div>
    </div>
  );
}
