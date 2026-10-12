import PageHeader from "@/components/shared/PageHeader";
import LabIntakeScanner from "@/features/lab-intake/components/LabIntakeScanner";

export const metadata = { title: "پذیرش با کد QR" };
export const dynamic = "force-dynamic";

export default function LabIntakeScanPage() {
  return <div className="space-y-5"><PageHeader title="پذیرش با کد QR" description="کد بیمار را بررسی کنید؛ دسترسی به اطلاعات فقط برای کارکنان مجاز همان شعبه امکان‌پذیر است." /><LabIntakeScanner /></div>;
}
