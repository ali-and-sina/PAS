import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorPatientsPage } from "@/features/patients/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "بیماران" };

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR").format(new Date(value));
}

export default async function DoctorPatientsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const result = await getDoctorPatientsPage(user.id, { page: params?.page ?? 1 });
  const patients = result.items;

  return (
    <>
      <PageHeader
        title="بیماران"
        description="بیماران دارای رابطه فعال با شما."
        actions={<Button asChild><Link href="/doctor/patients/new">افزودن بیمار</Link></Button>}
      />

      {patients.length === 0 ? (
        <EmptyState
          title="هنوز بیماری اضافه نشده است."
          description="از طریق کد ملی و شماره موبایل، بیمار ثبت‌شده را به فهرست خود اضافه کنید."
          action={{ href: "/doctor/patients/new", label: "افزودن بیمار" }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-right">
                <tr><th className="p-4 font-medium">بیمار</th><th className="p-4 font-medium">کد ملی</th><th className="p-4 font-medium">موبایل</th><th className="p-4 font-medium">تاریخ تولد</th><th className="p-4 font-medium">عملیات</th></tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{patient.full_name || "بدون نام"}</td>
                    <td className="p-4">{patient.national_id || "—"}</td>
                    <td className="p-4 dir-ltr text-right">{patient.phone || "—"}</td>
                    <td className="p-4">{formatDate(patient.patientProfile?.date_of_birth)}</td>
                    <td className="p-4"><Link href={`/doctor/patients/${patient.id}`} className="text-primary hover:underline">مشاهده پرونده</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination
        pathname="/doctor/patients"
        page={result.pagination.page}
        pageSize={result.pagination.pageSize}
        totalCount={result.pagination.totalCount}
        totalPages={result.pagination.totalPages}
      />
    </>
  );
}
