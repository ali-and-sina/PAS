import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import DoctorTable from "@/features/admin/components/DoctorTable";

export const metadata = { title: "پزشکان" };

export default async function AdminDoctorsPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.ADMIN) {
    redirect(LOGIN_PATH);
  }

  /*
    اینجا باید لیست پزشکان خوانده شود.
    کامپوننت مورد انتظار: getAdminDoctors()
    منبع: features/admin/queries.js (هنوز ساخته نشده — Backend contract)

    خروجی مورد انتظار: آرایه‌ای از
    { id, full_name, phone, medical_license_number, specialty,
      is_verified, created_at_display }
  */
  const doctors = [];

  const addDoctorButton = (
    <Button asChild size="sm">
      <Link href="/admin/doctors/new">
        <UserPlus aria-hidden="true" />
        افزودن پزشک
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="پزشکان"
        description="لیست پزشکان ثبت‌شده در سامانه."
        actions={addDoctorButton}
      />

      {doctors.length === 0 ? (
        <EmptyState
          title="هنوز پزشکی ثبت نشده است."
          description="با افزودن پزشک، حساب او در این لیست نمایش داده می‌شود."
          action={{ label: "افزودن پزشک", href: "/admin/doctors/new" }}
        />
      ) : (
        <DoctorTable doctors={doctors} />
      )}
    </>
  );
}
