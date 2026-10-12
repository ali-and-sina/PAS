import { getTestDisplayName } from "@/lib/medical/test-name";

export default function CorrectionHistoryDrawer({ observations }) {
  const history = observations.filter(
    (item) => item.status === "corrected" || item.status === "superseded",
  );
  if (!history.length) return null;
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        تاریخچه اصلاحات
      </summary>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {history.map((item) => (
          <li key={item.id}>
            {getTestDisplayName(item.test)}:{" "}
            {item.value_numeric ??
              item.value_text ??
              (item.value_boolean == null
                ? "—"
                : item.value_boolean
                  ? "مثبت"
                  : "منفی")}
          </li>
        ))}
      </ul>
    </details>
  );
}
