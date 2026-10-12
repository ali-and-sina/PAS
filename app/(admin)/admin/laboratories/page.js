import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminLaboratories } from "@/features/admin/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "آزمایشگاه‌ها" };

export default async function AdminLaboratoriesPage({ searchParams }) {
  const params = await searchParams;
  const result = await getAdminLaboratories({ page: params?.page ?? 1 });
  const laboratories = result.items;

  return (
    <div className="space-y-6">
      <PageHeader title="آزمایشگاه‌ها" description="حساب‌ها و سازمان‌های آزمایشگاهی تعریف‌شده در سامانه." actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/laboratories/branches"><Building2 aria-hidden="true" />مدیریت شعب</Link></Button><Button asChild><Link href="/admin/laboratories/new"><Plus aria-hidden="true" />ایجاد آزمایشگاه</Link></Button></div>} />
      {laboratories.length === 0 ? (
        <EmptyState icon={Building2} title="هنوز آزمایشگاهی ثبت نشده است" description="از مسیر ایجاد آزمایشگاه، اولین حساب سازمانی را بسازید." action={{ href: "/admin/laboratories/new", label: "ایجاد آزمایشگاه" }} />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>نام آزمایشگاه</TableHead><TableHead>مسئول حساب</TableHead><TableHead>شماره مجوز</TableHead><TableHead>وضعیت سازمان</TableHead></TableRow></TableHeader>
            <TableBody>
              {laboratories.map((laboratory) => (
                <TableRow key={laboratory.id}>
                  <TableCell><div className="space-y-1"><Link className="font-medium hover:underline" href={`/admin/laboratories/${laboratory.id}`}>{laboratory.organization?.name || "بدون سازمان"}</Link><p className="text-xs text-muted-foreground">{laboratory.organization?.type === "laboratory" ? "آزمایشگاه" : "—"}</p></div></TableCell>
                  <TableCell><div className="space-y-1"><p>{laboratory.full_name || "بدون نام"}</p><p dir="ltr" className="text-right text-xs text-muted-foreground">{laboratory.phone || "—"}</p></div></TableCell>
                  <TableCell dir="ltr" className="text-right">{laboratory.license_number}</TableCell>
                  <TableCell>فعال</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination pathname="/admin/laboratories" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
