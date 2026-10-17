import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminLaboratories } from "@/features/admin/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "آزمایشگاه‌ها" };

export default async function AdminLaboratoriesPage({ searchParams }) {
  const params = await searchParams;
  const result = await getAdminLaboratories({ page: params?.page ?? 1 });
  const laboratories = result.items;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="آزمایشگاه‌ها"
        description="حساب‌ها و سازمان‌های آزمایشگاهی تعریف‌شده در سامانه."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/admin/laboratories/branches"><Building2 aria-hidden="true" />مدیریت شعب</Link></Button>
            <Button asChild><Link href="/admin/laboratories/new"><Plus aria-hidden="true" />ایجاد آزمایشگاه</Link></Button>
          </>
        }
      />
      {laboratories.length === 0 ? (
        <EmptyState icon={Building2} title="هنوز آزمایشگاهی ثبت نشده است" description="از مسیر ایجاد آزمایشگاه، اولین حساب سازمانی را بسازید." action={{ href: "/admin/laboratories/new", label: "ایجاد آزمایشگاه" }} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام آزمایشگاه</TableHead>
                  <TableHead>مسئول حساب</TableHead>
                  <TableHead>شماره مجوز</TableHead>
                  <TableHead>وضعیت سازمان</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laboratories.map((laboratory) => (
                  <TableRow key={laboratory.id}>
                    <TableCell>
                      <div className="min-w-36 space-y-1">
                        <Link className="font-medium hover:underline" href={`/admin/laboratories/${laboratory.id}`}>{laboratory.organization?.name || "بدون سازمان"}</Link>
                        <p className="text-xs text-muted-foreground">{laboratory.organization?.type === "laboratory" ? "آزمایشگاه" : "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{laboratory.full_name || "بدون نام"}</p>
                        <p dir="ltr" className="text-start text-xs text-muted-foreground">{laboratory.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{laboratory.license_number || "—"}</TableCell>
                    <TableCell>فعال</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {laboratories.map((laboratory) => (
              <article key={laboratory.id} className="min-w-0 space-y-3 p-4">
                <div className="min-w-0">
                  <Link className="break-words font-semibold hover:underline" href={`/admin/laboratories/${laboratory.id}`}>{laboratory.organization?.name || "بدون سازمان"}</Link>
                  <p className="mt-1 text-xs text-muted-foreground">{laboratory.organization?.type === "laboratory" ? "آزمایشگاه" : "نوع سازمان نامشخص"}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">مسئول حساب</p>
                    <p className="mt-1 break-words">{laboratory.full_name || "بدون نام"}</p>
                    <p dir="ltr" className="mt-1 break-words text-start text-xs text-muted-foreground">{laboratory.phone || "—"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">شماره مجوز</p>
                    <p dir="ltr" className="mt-1 break-words text-start tabular-nums">{laboratory.license_number || "—"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">وضعیت: فعال</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <Pagination pathname="/admin/laboratories" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
