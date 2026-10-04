import Link from "next/link";
import { UserPlus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminDoctors } from "@/features/admin/queries";
import DoctorVerificationActions from "@/components/admin/DoctorVerificationActions";

export const metadata = { title: "پزشکان" };

export default async function AdminDoctorsPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status ?? "all";
  const doctors = await getAdminDoctors({ status });

  return (
    <div className="space-y-6">
      <PageHeader title="پزشکان" description="پزشکان ایجادشده توسط مدیر و وضعیت تأیید آن‌ها." actions={<Button asChild><Link href="/admin/doctors/new"><UserPlus aria-hidden="true" />ایجاد پزشک</Link></Button>} />
      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت پزشکان">
        <Button asChild size="sm" variant={status === "all" ? "default" : "outline"}><Link href="/admin/doctors">همه</Link></Button>
        <Button asChild size="sm" variant={status === "pending" ? "default" : "outline"}><Link href="/admin/doctors?status=pending">در انتظار تأیید</Link></Button>
        <Button asChild size="sm" variant={status === "verified" ? "default" : "outline"}><Link href="/admin/doctors?status=verified">تأییدشده</Link></Button>
      </div>
      {doctors.length === 0 ? (
        <EmptyState title="پزشکی پیدا نشد" description="برای این وضعیت هنوز حساب پزشکی وجود ندارد." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>پزشک</TableHead><TableHead>شماره نظام پزشکی</TableHead><TableHead>تخصص</TableHead><TableHead>وضعیت</TableHead><TableHead className="w-px">عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell><div className="space-y-1"><Link className="font-medium hover:underline" href={`/admin/doctors/${doctor.id}`}>{doctor.full_name || "بدون نام"}</Link><p dir="ltr" className="text-right text-xs text-muted-foreground">{doctor.phone || "—"}</p></div></TableCell>
                  <TableCell dir="ltr" className="text-right">{doctor.medical_license_number}</TableCell>
                  <TableCell>{doctor.specialty || "—"}</TableCell>
                  <TableCell>{doctor.is_verified ? "تأییدشده" : "در انتظار تأیید"}</TableCell>
                  <TableCell><DoctorVerificationActions doctorId={doctor.id} isVerified={doctor.is_verified} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
