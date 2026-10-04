import OrderStatusBadge from "./OrderStatusBadge";

export default function OrderSummaryCard({ order }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold">{order.patient?.full_name || "بیمار"}</p><p className="mt-1 text-sm text-muted-foreground">پزشک: {order.doctor?.full_name || "—"}</p></div>
        <OrderStatusBadge status={order.status} />
      </div>
    </div>
  );
}
