import { LockKeyhole } from "lucide-react";
import StatusPage from "@/components/shared/StatusPage";

export const metadata = { title: "دسترسی غیرمجاز" };

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      icon={LockKeyhole}
      title="دسترسی امکان‌پذیر نیست"
      description="حساب شما مجوز مشاهده این بخش را ندارد. برای ادامه، به فضای کاری خود برگردید یا با مدیر سامانه هماهنگ کنید."
      primaryHref="/"
      primaryLabel="بازگشت به صفحه اصلی"
    />
  );
}
