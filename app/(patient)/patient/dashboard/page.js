import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export const metadata = { title: "داشبورد" };

export default function PatientDashboardPage() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="آخرین نتیجه، تفسیر پزشک، روند و نسخه‌های شما در یک نگاه."
      />
      <EmptyState
        title="هنوز آزمایشی ثبت نشده است."
        description="وقتی پزشک شما سفارش آزمایش ثبت کند، نتیجه اینجا نمایش داده می‌شود."
      />
    </>
  );
}
