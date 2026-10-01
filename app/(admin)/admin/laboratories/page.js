import Link from "next/link";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import LaboratoryTable from "@/features/admin/components/LaboratoryTable";

export const metadata = { title: "آزمایشگاه‌ها" };

export default async function AdminLaboratoriesPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.ADMIN) {
    redirect(LOGIN_PATH);
  }

  /*
    اینجا باید لیست آزمایشگاه‌ها خوانده شود.
    کامپوننت مورد انتظار: getAdminLaboratories()
    منبع: features/admin/queries.js (هنوز ساخته نشده — Backend contract)

    خروجی مورد انتظار: آرایه‌ای از
    { id, organization_name, phone, license_number, organization_type,
      created_at_display }
  */
  const laboratories = [];

  const addLabButton = (
    <Button asChild size="sm">
      <Link href="/admin/laboratories/new">
        <FlaskConical aria-hidden="true" />
        افزودن آزمایشگاه
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="آزمایشگاه‌ها"
        description="لیست آزمایشگاه‌های ثبت‌شده در سامانه."
        actions={addLabButton}
      />

      {laboratories.length === 0 ? (
        <EmptyState
          title="هنوز آزمایشگاهی ثبت نشده است."
          description="با افزودن آزمایشگاه، حساب آن در این لیست نمایش داده می‌شود."
          action={{
            label: "افزودن آزمایشگاه",
            href: "/admin/laboratories/new",
          }}
        />
      ) : (
        <LaboratoryTable laboratories={laboratories} />
      )}
    </>
  );
}
