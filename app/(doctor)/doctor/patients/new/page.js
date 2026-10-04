import Link from "next/link";

import PageHeader from "@/components/shared/PageHeader";
import PatientForm from "@/features/patients/components/PatientForm";

export const metadata = { title: "افزودن بیمار" };

export default function NewDoctorPatientPage() {
  return (
    <>
      <PageHeader
        title="افزودن بیمار"
        description="بیمار ثبت‌شده در سامانه را به فهرست بیماران خود اضافه کنید."
        actions={<Link href="/doctor/patients" className="text-sm text-muted-foreground hover:underline">بازگشت به بیماران</Link>}
      />
      <div className="max-w-xl"><PatientForm /></div>
    </>
  );
}
