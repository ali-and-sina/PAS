export default function LabOrderItemList({ items = [] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">آیتمی ثبت نشده است.</p>;
  return <ul className="space-y-2">{items.map((item) => <li key={item.id} className="rounded-lg border p-3 text-sm">{item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"}</li>)}</ul>;
}
