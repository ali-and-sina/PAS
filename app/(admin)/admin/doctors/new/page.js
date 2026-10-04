import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createDoctor } from "@/features/admin/actions";
import { DoctorForm, FormIntro, SecondaryNote } from "@/components/admin/AdminForm";

export const metadata = { title: "ایجاد پزشک" };

export default function NewDoctorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="ایجاد پزشک" description="حساب پزشک را از مسیر مدیریتی ایجاد کنید." actions={<Button asChild variant="ghost"><Link href="/admin/doctors"><ArrowRight aria-hidden="true" />بازگشت</Link></Button>} />
      <FormIntro type="doctor" />
      <Card><CardContent className="p-6"><DoctorForm action={createDoctor} /></CardContent></Card>
      <SecondaryNote>حساب جدید با وضعیت «در انتظار تأیید» ساخته می‌شود.</SecondaryNote>
    </div>
  );
}
