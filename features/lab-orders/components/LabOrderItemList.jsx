import { getTestDisplayName } from "@/lib/medical/test-name";

export default function LabOrderItemList({ items = [] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">آیتمی ثبت نشده است.</p>;
  return <ul className="space-y-2">{items.map((item) => <li key={item.id} className="rounded-lg border p-3 text-sm">{getTestDisplayName(item.panel || item.test)}</li>)}</ul>;
}
