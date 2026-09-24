import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = { title: "داشبورد" };

export default function DoctorDashboardPage() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="بیماران، سفارش‌های در انتظار بررسی و آخرین نتایج."
      />
      <EmptyState
        title="هنوز بیماری اضافه نشده است."
        description="با اضافه‌کردن بیمار، اطلاعات عملیاتی او اینجا نمایش داده می‌شود."
      />
    </>
  );
}
