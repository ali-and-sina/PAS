import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import LabOrderForm from "@/features/lab-orders/components/LabOrderForm";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorPatients } from "@/features/patients/queries";
import { getLaboratories, getTestPanels } from "@/features/lab-orders/queries";

export const metadata = { title: "سفارش آزمایش جدید" };

export default async function NewLabOrderPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const [patients, laboratories, testPanels] = await Promise.all([getDoctorPatients(user.id), getLaboratories(), getTestPanels()]);

  return (
    <>
      <PageHeader title="سفارش آزمایش جدید" description="آزمایش را برای یکی از بیماران مرتبط با خود ثبت کنید." actions={<Link href="/doctor/lab-orders" className="text-sm text-muted-foreground hover:underline">بازگشت</Link>} />
      {patients.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">ابتدا یک بیمار به فهرست خود اضافه کنید.</div> : laboratories.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">هیچ آزمایشگاهی برای انتخاب در سامانه موجود نیست.</div> : testPanels.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">هنوز پنل آزمایش در کاتالوگ ثبت نشده است.</div> : <div className="max-w-2xl"><LabOrderForm patients={patients} laboratories={laboratories} testPanels={testPanels} defaultPatientId={params?.patientId || ""} /></div>}
    </>
  );
}
