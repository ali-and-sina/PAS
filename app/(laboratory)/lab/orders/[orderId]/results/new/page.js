import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import ResultEntryForm from "@/features/lab-results/components/ResultEntryForm";
import { getLabOrder, getLabOrderTests, getLabReport } from "@/features/lab/queries";
import { getSessionUser } from "@/lib/auth/server";

export const metadata = { title: "ثبت نتیجه آزمایش" };
export const dynamic = "force-dynamic";

export default async function NewLabResultPage({ params }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "laboratory") redirect("/login");

  const { orderId } = await params;
  const order = await getLabOrder(orderId);
  if (!order) notFound();
  if (order.status !== "in_progress") redirect(`/lab/orders/${order.id}`);

  const tests = await getLabOrderTests(order.id);
  if (!tests.length) redirect(`/lab/orders/${order.id}`);

  const draftReport = order.reports.find((report) => report.status === "draft");
  const draft = draftReport ? await getLabReport(draftReport.id) : null;
  const draftValues = Object.fromEntries(
    (draft?.observations || [])
      .filter((observation) => observation.status === "preliminary")
      .map((observation) => [
        observation.test_definition_id,
        observation.value_numeric ?? observation.value_text ?? (observation.value_boolean == null ? "" : String(observation.value_boolean)),
      ]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={draftReport ? "ادامه ثبت نتیجه" : "ثبت نتیجه آزمایش"}
        description={`بیمار: ${order.patient?.full_name || "بدون نام"}`}
        actions={
          <Link href={`/lab/orders/${order.id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            بازگشت به سفارش
          </Link>
        }
      />

      <div className="rounded-xl border bg-accent/30 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-primary">
            <ClipboardCheck className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">ورود ساختاریافته نتیجه</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">هر آزمایش را دقیقاً در ردیف مربوط به خودش وارد کنید. نتیجه نهایی فقط بعد از تکمیل موارد الزامی قابل ثبت است.</p>
          </div>
        </div>
      </div>

      <SectionCard title="نتایج سفارش" description="نتایج ابتدا به‌صورت پیش‌نویس ذخیره می‌شوند و سپس در صورت تکمیل موارد الزامی می‌توانید گزارش را نهایی کنید.">
        <ResultEntryForm orderId={order.id} reportId={draftReport?.id || null} tests={tests} defaultValues={draftValues} />
      </SectionCard>
    </div>
  );
}
