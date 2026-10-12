import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import LabOrderForm from "@/features/lab-orders/components/LabOrderForm";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorPatients } from "@/features/patients/queries";
import { getTestPanels, getTestDefinitions } from "@/features/lab-orders/queries";

export const metadata = { title: "ثبت درخواست آزمایش" };

export default async function NewLabOrderPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const [patients, testPanels, testDefinitions] = await Promise.all([
    getDoctorPatients(user.id),
    getTestPanels(),
    getTestDefinitions(),
  ]);

  return (
    <>
      <PageHeader title="ثبت درخواست آزمایش" description="آزمایش‌های لازم را در پرونده بیمار ثبت کنید. بیمار آزمایشگاه مقصد را انتخاب می‌کند." actions={<Link href="/doctor/lab-orders" className="text-sm text-muted-foreground hover:underline">بازگشت به درخواست‌ها</Link>} />
      {patients.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">ابتدا یک بیمار با رابطهٔ فعال به فهرست خود اضافه کنید.</div> : (testPanels.length === 0 && testDefinitions.length === 0) ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">هنوز آزمایش یا پنل فعالی در کاتالوگ ثبت نشده است.</div> : <div className="max-w-3xl"><LabOrderForm patients={patients} testPanels={testPanels} testDefinitions={testDefinitions} defaultPatientId={params?.patientId || params?.patient || ""} /></div>}
    </>
  );
}
