import Link from "next/link";
import { UserPlus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminDoctors } from "@/features/admin/queries";
import DoctorVerificationActions from "@/components/admin/DoctorVerificationActions";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "پزشکان" };

export default async function AdminDoctorsPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status ?? "all";
  const page = params?.page ?? 1;
  const result = await getAdminDoctors({ status, page });
  const doctors = result.items;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="پزشکان"
        description="پزشکان ایجادشده توسط مدیر و وضعیت تأیید آن‌ها."
        actions={<Button asChild><Link href="/admin/doctors/new"><UserPlus aria-hidden="true" />ایجاد پزشک</Link></Button>}
      />
      <nav className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت پزشکان">
        <Button asChild size="sm" variant={status === "all" ? "default" : "outline"}><Link href="/admin/doctors">همه</Link></Button>
        <Button asChild size="sm" variant={status === "pending" ? "default" : "outline"}><Link href="/admin/doctors?status=pending">در انتظار تأیید</Link></Button>
        <Button asChild size="sm" variant={status === "verified" ? "default" : "outline"}><Link href="/admin/doctors?status=verified">تأییدشده</Link></Button>
      </nav>

      {doctors.length === 0 ? (
        <EmptyState title="پزشکی پیدا نشد" description="برای این وضعیت هنوز حساب پزشکی وجود ندارد." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پزشک</TableHead>
                  <TableHead>شماره نظام پزشکی</TableHead>
                  <TableHead>تخصص</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead className="w-px">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell>
                      <div className="min-w-36 space-y-1">
                        <Link className="font-medium hover:underline" href={`/admin/doctors/${doctor.id}`}>{doctor.full_name || "بدون نام"}</Link>
                        <p dir="ltr" className="text-start text-xs text-muted-foreground">{doctor.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{doctor.medical_license_number || "—"}</TableCell>
                    <TableCell>{doctor.specialty || "—"}</TableCell>
                    <TableCell>{doctor.is_verified ? "تأییدشده" : "در انتظار تأیید"}</TableCell>
                    <TableCell><DoctorVerificationActions doctorId={doctor.id} isVerified={doctor.is_verified} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {doctors.map((doctor) => (
              <article key={doctor.id} className="min-w-0 space-y-3 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="break-words font-semibold hover:underline" href={`/admin/doctors/${doctor.id}`}>{doctor.full_name || "بدون نام"}</Link>
                    <p dir="ltr" className="mt-1 break-words text-start text-xs text-muted-foreground">{doctor.phone || "—"}</p>
                  </div>
                  <span className={doctor.is_verified ? "shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700" : "shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800"}>
                    {doctor.is_verified ? "تأییدشده" : "در انتظار تأیید"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">شماره نظام پزشکی</p>
                    <p dir="ltr" className="mt-1 break-words text-start tabular-nums">{doctor.medical_license_number || "—"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">تخصص</p>
                    <p className="mt-1 break-words">{doctor.specialty || "—"}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <DoctorVerificationActions doctorId={doctor.id} isVerified={doctor.is_verified} />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <Pagination pathname="/admin/doctors" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} query={{ status }} />
    </div>
  );
}
