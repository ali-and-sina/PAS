import { SearchX } from "lucide-react";
import StatusPage from "@/components/shared/StatusPage";

export const metadata = { title: "صفحه یافت نشد" };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      icon={SearchX}
      title="صفحه‌ای که دنبالش هستید پیدا نشد"
      description="ممکن است نشانی صفحه اشتباه باشد یا صفحه جابه‌جا شده باشد. از مسیرهای فضای کاری خود برای ادامه استفاده کنید."
      primaryHref="/"
      primaryLabel="بازگشت به صفحه اصلی"
    />
  );
}
