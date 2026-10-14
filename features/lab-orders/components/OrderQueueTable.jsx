import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import OrderStatusBadge from "./OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTestDisplayName } from "@/lib/medical/test-name";

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

function getTestsLabel(order) {
  const names = order.items
    .map((item) => getTestDisplayName(item.panel || item.test))
    .filter(Boolean);

  if (!names.length) return "بدون آزمایش";
  if (names.length <= 2) return names.join("، ");
  return `${names.slice(0, 2).join("، ")} + ${names.length - 2} مورد دیگر`;
}

function getNextAction(order) {
  if (order.status === "pending") return "پذیرش آزمایش";
  if (order.status === "received_by_lab") return "شروع آزمایش";
  if (order.status === "in_progress") return "ثبت نتیجه";
  if (order.status === "completed") return "مشاهده";
  return "جزئیات";
}

export default function OrderQueueTable({ orders = [] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>بیمار</TableHead>
              <TableHead>پزشک</TableHead>
              <TableHead>آزمایش</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead className="text-end">اقدام</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <div className="min-w-36">
                    <p className="font-medium">{order.patient?.full_name || "بدون نام"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{String(order.id).slice(0, 8)}…</p>
                  </div>
                </TableCell>
                <TableCell>{order.doctor?.full_name || "بدون نام"}</TableCell>
                <TableCell className="max-w-64">
                  <span className="line-clamp-2 text-sm">{getTestsLabel(order)}</span>
                </TableCell>
                <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.ordered_at)}</TableCell>
                <TableCell className="text-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/lab/orders/${order.id}`}>
                      {getNextAction(order)}
                      <ArrowLeft className="ms-1 size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y md:hidden">
        {orders.map((order) => (
          <Link key={order.id} href={`/lab/orders/${order.id}`} className="block p-4 transition-colors hover:bg-accent/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{order.patient?.full_name || "بدون نام"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{order.doctor?.full_name || "پزشک"}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{getTestsLabel(order)}</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{formatDate(order.ordered_at)}</span>
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                {getNextAction(order)}
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
