import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import LaboratoryForm from "@/features/admin/components/LaboratoryForm";

export const metadata = { title: "افزودن آزمایشگاه" };

export default function NewLaboratoryPage() {
  return (
    <>
      <PageHeader
        title="افزودن آزمایشگاه"
        description="یک حساب آزمایشگاه جدید در سامانه ثبت کنید."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/laboratories">
              <ArrowRight aria-hidden="true" />
              بازگشت به لیست
            </Link>
          </Button>
        }
      />
      <LaboratoryForm />
    </>
  );
}
