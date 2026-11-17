import { WifiOff } from "lucide-react";
import StatusPage from "@/components/shared/StatusPage";

export const metadata = { title: "عدم دسترسی به اینترنت" };

export default function OfflinePage() {
  return (
    <StatusPage
      code="OFFLINE"
      icon={WifiOff}
      title="اتصال اینترنت برقرار نیست"
      description="برای دریافت یا ثبت اطلاعات، اتصال اینترنت را بررسی کنید. پس از برقراری ارتباط، صفحه را دوباره باز کنید. تا زمان اتصال، امکان تضمین دسترسی به داده‌های زنده وجود ندارد."
      primaryHref="/"
      primaryLabel="تلاش برای بازگشت"
    />
  );
}
