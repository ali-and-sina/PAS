import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import DoctorForm from "@/features/admin/components/DoctorForm";

export const metadata = { title: "افزودن پزشک" };

export default function NewDoctorPage() {
  return (
    <>
      <PageHeader
        title="افزودن پزشک"
        description="یک حساب پزشک جدید در سامانه ثبت کنید."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/doctors">
              <ArrowRight aria-hidden="true" />
              بازگشت به لیست
            </Link>
          </Button>
        }
      />
      <DoctorForm />
    </>
  );
}
