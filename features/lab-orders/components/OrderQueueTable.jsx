import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OrderStatusBadge from "./OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export default function OrderQueueTable({ orders }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>بیمار</TableHead>
            <TableHead>پزشک</TableHead>
            <TableHead>آزمایش</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>تاریخ</TableHead>
            <TableHead className="text-end">جزئیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.patient?.full_name || "بدون نام"}</TableCell>
              <TableCell>{order.doctor?.full_name || "بدون نام"}</TableCell>
              <TableCell>{order.items.map((item) => item.panel?.name || item.test?.name_fa || item.test?.name || "آزمایش").join("، ") || "—"}</TableCell>
              <TableCell><OrderStatusBadge status={order.status} /></TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.ordered_at)}</TableCell>
              <TableCell className="text-end">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/lab/orders/${order.id}`}>مشاهده <ArrowLeft className="ms-1 size-4" /></Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
