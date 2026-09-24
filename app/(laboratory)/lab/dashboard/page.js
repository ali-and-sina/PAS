import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = { title: "داشبورد" };

export default function LabDashboardPage() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="خلاصه صف سفارش‌ها و آخرین آزمایش‌های دریافتی."
      />
      <EmptyState
        title="سفارش جدیدی دریافت نشده است."
        description="سفارش‌های ثبت‌شده توسط پزشکان اینجا نمایش داده می‌شوند."
      />
    </>
  );
}
