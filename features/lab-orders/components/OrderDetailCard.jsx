import OrderStatusBadge from "./OrderStatusBadge";
import SectionCard from "@/components/shared/SectionCard";

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export default function OrderDetailCard({ order }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="خلاصه سفارش">
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{order.patient?.full_name || "—"}</dd></div>
          <div><dt className="text-muted-foreground">پزشک</dt><dd className="mt-1">{order.doctor?.full_name || "—"}</dd></div>
          <div><dt className="text-muted-foreground">وضعیت</dt><dd className="mt-1"><OrderStatusBadge status={order.status} /></dd></div>
          <div><dt className="text-muted-foreground">تاریخ ثبت</dt><dd className="mt-1">{formatDate(order.ordered_at)}</dd></div>
          <div><dt className="text-muted-foreground">تاریخ دریافت</dt><dd className="mt-1">{formatDate(order.received_at)}</dd></div>
          <div><dt className="text-muted-foreground">تاریخ تکمیل</dt><dd className="mt-1">{formatDate(order.completed_at)}</dd></div>
        </dl>
      </SectionCard>

      <SectionCard title="آزمایش‌های درخواست‌شده">
        {order.items.length ? (
          <ul className="space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                {item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش"}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">آیتمی برای این سفارش ثبت نشده است.</p>}
      </SectionCard>

      <SectionCard title="یادداشت بالینی" className="lg:col-span-2">
        <p className="whitespace-pre-wrap text-sm leading-7">{order.clinical_note || "یادداشت بالینی ثبت نشده است."}</p>
      </SectionCard>
    </div>
  );
}
