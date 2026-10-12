import OrderStatusBadge from "./OrderStatusBadge";
import SectionCard from "@/components/shared/SectionCard";
import { getTestDisplayName } from "@/lib/medical/test-name";

export default function OrderDetailCard({ order }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="خلاصه سفارش">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">بیمار</dt>
            <dd className="mt-1 font-medium">
              {order.patient?.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">پزشک</dt>
            <dd className="mt-1">{order.doctor?.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">وضعیت</dt>
            <dd className="mt-1">
              <OrderStatusBadge status={order.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">شناسه سفارش</dt>
            <dd className="mt-1 font-mono text-xs" dir="ltr">
              {order.id}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="آزمایش‌های درخواست‌شده">
        {order.items.length ? (
          <ol className="space-y-2">
            {order.items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">
                    {getTestDisplayName(item.panel || item.test)}
                  </p>
                  {item.test?.internal_code ? (
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {item.test.internal_code}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            آیتمی برای این سفارش ثبت نشده است.
          </p>
        )}
      </SectionCard>

      <SectionCard title="یادداشت بالینی" className="lg:col-span-2">
        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {order.clinical_note || "یادداشت بالینی ثبت نشده است."}
        </p>
      </SectionCard>
    </div>
  );
}
