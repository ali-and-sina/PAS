import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminUsers } from "@/features/admin/queries";
import Pagination from "@/components/shared/Pagination";

const roleLabels = { patient: "بیمار", doctor: "پزشک", laboratory: "آزمایشگاه", admin: "مدیر" };
const statusLabels = { verified: "تأییدشده", pending: "در انتظار تأیید", complete: "تکمیل‌شده", incomplete: "ناقص", active: "فعال" };

export const metadata = { title: "کاربران" };

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  const role = params?.role ?? "all";
  const search = params?.q ?? "";
  const page = params?.page ?? 1;
  const result = await getAdminUsers({ role, search, page });
  const users = result.items;

  return (
    <div className="space-y-6">
      <PageHeader title="کاربران" description="نمایش خلاصه‌ای از حساب‌های بیمار، پزشک و آزمایشگاه." />
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-3 md:flex-row" method="get" data-navigation-feedback="true">
            <input name="q" defaultValue={search} placeholder="جستجو با نام یا موبایل" aria-label="جستجوی کاربران" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
            <select name="role" defaultValue={role} aria-label="فیلتر نقش" className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring">
              <option value="all">همه نقش‌ها</option>
              <option value="patient">بیمار</option>
              <option value="doctor">پزشک</option>
              <option value="laboratory">آزمایشگاه</option>
              <option value="admin">مدیر</option>
            </select>
            <Button type="submit">اعمال فیلتر</Button>
          </form>
        </CardContent>
      </Card>
      {users.length === 0 ? (
        <EmptyState title="کاربری پیدا نشد" description="با فیلتر دیگری دوباره جستجو کنید." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>نام</TableHead><TableHead>موبایل</TableHead><TableHead>نقش</TableHead><TableHead>وضعیت</TableHead><TableHead>تاریخ ایجاد</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium"><Link href={`/admin/users/${user.id}`} className="hover:underline">{user.full_name || "بدون نام"}</Link></TableCell>
                  <TableCell dir="ltr" className="text-right">{user.phone || "—"}</TableCell>
                  <TableCell>{roleLabels[user.role] || "نامشخص"}</TableCell>
                  <TableCell>{statusLabels[user.status] || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right">{new Date(user.created_at).toLocaleDateString("fa-IR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination pathname="/admin/users" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} query={{ role, q: search }} />
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link href="/admin/doctors/new">ایجاد پزشک</Link></Button>
        <Button asChild variant="outline"><Link href="/admin/laboratories/new">ایجاد آزمایشگاه</Link></Button>
      </div>
    </div>
  );
}
