import PageHeader from "@/components/shared/PageHeader";
import ConsultationsBoard from "@/features/care/components/ConsultationsBoard";
import { getConsultationsData } from "@/features/care/queries";
export const dynamic = "force-dynamic";
export const metadata = { title: "ویزیت آنلاین" };
export default async function ConsultationsPage() {
  const data = await getConsultationsData("doctor");
  return <div className="space-y-6"><PageHeader title="ویزیت آنلاین" description="درخواست، پذیرش و گفت‌وگوی متنی و ویسی با پزشک؛ در این مرحله بدون پرداخت آنلاین." /><ConsultationsBoard data={data} /></div>;
}
