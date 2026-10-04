import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import ResultEntryForm from "@/features/lab-results/components/ResultEntryForm";
import {
  getLabOrder,
  getLabOrderTests,
  getLabReport,
} from "@/features/lab/queries";
import { getSessionUser } from "@/lib/auth/server";

export const metadata = {
  title: "ثبت نتیجه آزمایش",
};

export default async function NewLabResultPage({
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

  if (order.status !== "in_progress") {
    redirect(
      `/lab/orders/${order.id}`,
    );
  }

  const tests = await getLabOrderTests(
    order.id,
  );

  if (!tests.length) {
    redirect(
      `/lab/orders/${order.id}`,
    );
  }

  const draftReport =
    order.reports.find(
      (report) =>
        report.status === "draft",
    );

  const draft = draftReport
    ? await getLabReport(
        draftReport.id,
      )
    : null;

  const draftValues = Object.fromEntries(
    (draft?.observations || [])
      .filter(
        (observation) =>
          observation.status ===
          "preliminary",
      )
      .map((observation) => [
        observation.test_definition_id,
        observation.value_numeric ??
          observation.value_text ??
          (observation.value_boolean == null
            ? ""
            : String(
                observation.value_boolean,
              )),
      ]),
  );

  return (
    <>
      <PageHeader
        title="ثبت نتیجه آزمایش"
        description={`بیمار: ${order.patient?.full_name || "بدون نام"}`}
        actions={
          <Link
            href={`/lab/orders/${order.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            بازگشت به سفارش
          </Link>
        }
      />

      <SectionCard
        title="ورودی نتایج"
        description="نتایج ابتدا به‌صورت پیش‌نویس ثبت می‌شوند. برای نهایی‌سازی، همه آزمایش‌های الزامی باید نتیجه معتبر داشته باشند."
      >
        <ResultEntryForm
          orderId={order.id}
          reportId={
            draftReport?.id ||
            null
          }
          tests={tests}
          defaultValues={
            draftValues
          }
        />
      </SectionCard>
    </>
  );
}
