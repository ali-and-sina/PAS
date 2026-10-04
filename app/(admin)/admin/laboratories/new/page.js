import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createLaboratory } from "@/features/admin/actions";
import { FormIntro, LaboratoryForm, SecondaryNote } from "@/components/admin/AdminForm";

export const metadata = { title: "ایجاد آزمایشگاه" };

export default function NewLaboratoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="ایجاد آزمایشگاه" description="حساب سازمانی آزمایشگاه را همراه با سازمان مرتبط ایجاد کنید." actions={<Button asChild variant="ghost"><Link href="/admin/laboratories"><ArrowRight aria-hidden="true" />بازگشت</Link></Button>} />
      <FormIntro type="laboratory" />
      <Card><CardContent className="p-6"><LaboratoryForm action={createLaboratory} /></CardContent></Card>
      <SecondaryNote>برای حساب جدید یک سازمان از نوع آزمایشگاه ساخته و به پروفایل آن متصل می‌شود.</SecondaryNote>
    </div>
  );
}
