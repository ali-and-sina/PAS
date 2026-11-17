import { Wrench } from "lucide-react";
import StatusPage from "@/components/shared/StatusPage";

export const metadata = { title: "در حال به‌روزرسانی" };

export default function MaintenancePage() {
  return (
    <StatusPage
      code="MAINTENANCE"
      icon={Wrench}
      title="پاس موقتاً در حال به‌روزرسانی است"
      description="برای بهبود کیفیت و پایداری خدمات، این بخش موقتاً در دسترس نیست. لطفاً کمی بعد دوباره مراجعه کنید."
      primaryHref="/"
      primaryLabel="بازگشت به صفحه اصلی"
    />
  );
}
