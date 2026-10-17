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

function PatientDetails({ patient }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">کد ملی</p>
        <p className="mt-1 break-words tabular-nums">{patient.national_id || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">شمارهٔ موبایل</p>
        <p dir="ltr" className="mt-1 break-words text-start tabular-nums">{patient.phone || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">تاریخ تولد</p>
        <p className="mt-1">{formatDate(patient.patientProfile?.date_of_birth)}</p>
      </div>
    </div>
  );
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
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/40 text-start">
                  <tr>
                    <th className="p-4 text-start font-medium">بیمار</th>
                    <th className="p-4 text-start font-medium">کد ملی</th>
                    <th className="p-4 text-start font-medium">موبایل</th>
                    <th className="p-4 text-start font-medium">تاریخ تولد</th>
                    <th className="p-4 text-start font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="border-b last:border-0">
                      <td className="p-4 font-medium">{patient.full_name || "بدون نام"}</td>
                      <td className="p-4 tabular-nums">{patient.national_id || "—"}</td>
                      <td dir="ltr" className="p-4 text-start tabular-nums">{patient.phone || "—"}</td>
                      <td className="p-4">{formatDate(patient.patientProfile?.date_of_birth)}</td>
                      <td className="p-4">
                        <Link href={`/doctor/patients/${patient.id}`} className="text-primary hover:underline">مشاهده پرونده</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {patients.map((patient) => (
              <article key={patient.id} className="min-w-0 rounded-xl border bg-card p-4">
                <h2 className="break-words font-semibold">{patient.full_name || "بدون نام"}</h2>
                <PatientDetails patient={patient} />
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link href={`/doctor/patients/${patient.id}`}>مشاهدهٔ پرونده</Link>
                </Button>
              </article>
            ))}
          </div>
        </>
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
