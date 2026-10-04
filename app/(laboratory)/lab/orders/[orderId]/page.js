import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import OrderDetailCard from "@/features/lab-orders/components/OrderDetailCard";
import OrderStatusBadge from "@/features/lab-orders/components/OrderStatusBadge";
import { getLabOrder } from "@/features/lab/queries";
import { getSessionUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updateLabOrderStatus } from "@/features/lab-results/actions";

export const metadata = {
  title: "جزئیات سفارش آزمایش",
};

function StatusAction({
  orderId,
  status,
  label,
  variant = "default",
}) {
  return (
    <form action={updateLabOrderStatus}>
      <input
        type="hidden"
        name="order_id"
        value={orderId}
      />
      <input
        type="hidden"
        name="status"
        value={status}
      />
      <Button
        type="submit"
        size="sm"
        variant={variant}
      >
        {label}
      </Button>
    </form>
  );
}

export default async function LabOrderDetailPage({
  params,
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "laboratory") {
    redirect("/login");
  }

  const { orderId } = await params;

  const order = await getLabOrder(orderId);

  if (!order) {
    notFound();
  }

  const draftReport =
    order.reports.find(
      (report) =>
        report.status === "draft",
    );

  const canEnter =
    order.status === "in_progress";

  const canCancel = [
    "pending",
    "received_by_lab",
    "in_progress",
  ].includes(order.status);

  return (
    <>
      <PageHeader
        title="جزئیات سفارش"
        description={`بیمار: ${order.patient?.full_name || "بدون نام"}`}
        actions={
          <Button
            asChild
            variant="outline"
          >
            <Link href="/lab/orders">
              بازگشت
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <OrderStatusBadge
          status={order.status}
        />

        {order.status ===
        "pending" ? (
          <StatusAction
            orderId={order.id}
            status="received_by_lab"
            label="دریافت سفارش"
          />
        ) : null}

        {order.status ===
        "received_by_lab" ? (
          <StatusAction
            orderId={order.id}
            status="in_progress"
            label="شروع انجام آزمایش"
          />
        ) : null}

        {canEnter ? (
          <Button
            asChild
            size="sm"
          >
            <Link
              href={`/lab/orders/${order.id}/results/new`}
            >
              {draftReport
                ? "ادامه ثبت نتیجه"
                : "ثبت نتیجه"}
            </Link>
          </Button>
        ) : null}

        {canCancel ? (
          <StatusAction
            orderId={order.id}
            status="cancelled"
            label="لغو سفارش"
            variant="outline"
          />
        ) : null}
      </div>

      <OrderDetailCard order={order} />

      {order.reports.length ? (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {order.reports.map(
                (report) => (
                  <div
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <span>
                      گزارش{" "}
                      {report.status ===
                      "draft"
                        ? "پیش‌نویس"
                        : report.status ===
                            "amended"
                          ? "اصلاح‌شده"
                          : "نهایی"}
                    </span>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <Link
                        href={`/lab/results/${report.id}`}
                      >
                        مشاهده نتیجه
                      </Link>
                    </Button>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
