import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminUsers } from "@/features/admin/queries";
import Pagination from "@/components/shared/Pagination";

const roleLabels = { patient: "بیمار", doctor: "پزشک", laboratory: "مرکز درمانی", medical_center: "مرکز درمانی", admin: "مدیر" };
const statusLabels = { verified: "تأییدشده", pending: "در انتظار تأیید", complete: "تکمیل‌شده", incomplete: "ناقص", active: "فعال" };

export const metadata = { title: "کاربران" };

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fa-IR");
}

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  const role = params?.role ?? "all";
  const search = params?.q ?? "";
  const page = params?.page ?? 1;
  const result = await getAdminUsers({ role, search, page });
  const users = result.items;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="کاربران" description="نمایش و مدیریت حساب‌های بیمار، پزشک و مراکز درمانی." />

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_auto] md:items-end" method="get" data-navigation-feedback="true">
            <label htmlFor="admin-user-search" className="grid min-w-0 gap-2 text-sm font-medium">
              جست‌وجوی کاربر
              <Input id="admin-user-search" name="q" defaultValue={search} placeholder="نام یا شمارهٔ همراه" autoComplete="off" />
            </label>
            <label htmlFor="admin-user-role" className="grid gap-2 text-sm font-medium">
              نقش کاربر
              <select id="admin-user-role" name="role" defaultValue={role} className="min-h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="all">همهٔ نقش‌ها</option>
                <option value="patient">بیمار</option>
                <option value="doctor">پزشک</option>
                <option value="laboratory">مرکز درمانی</option>
                <option value="admin">مدیر</option>
              </select>
            </label>
            <Button type="submit" className="w-full md:w-auto">اعمال فیلتر</Button>
          </form>
        </CardContent>
      </Card>

      {users.length === 0 ? (
        <EmptyState title="کاربری پیدا نشد" description="عبارت جست‌وجو یا فیلتر نقش را تغییر دهید." />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {users.map((user) => (
              <article key={user.id} className="min-w-0 rounded-2xl border bg-card p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${user.id}`} className="break-words font-semibold hover:text-primary hover:underline">
                      {user.full_name || "بدون نام"}
                    </Link>
                    <p dir="ltr" className="mt-1 break-all text-start text-sm text-muted-foreground tabular-nums">{user.phone || "شماره همراه ثبت نشده"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{roleLabels[user.role] || "نامشخص"}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">وضعیت حساب</dt>
                    <dd className="mt-1 break-words font-medium">{statusLabels[user.status] || "ثبت نشده"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">تاریخ ایجاد</dt>
                    <dd className="mt-1 text-muted-foreground">{formatDate(user.created_at)}</dd>
                  </div>
                </dl>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href={`/admin/users/${user.id}`}>مشاهدهٔ حساب</Link>
                </Button>
              </article>
            ))}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>موبایل</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ ایجاد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium"><Link href={`/admin/users/${user.id}`} className="hover:underline">{user.full_name || "بدون نام"}</Link></TableCell>
                    <TableCell dir="ltr" className="text-right tabular-nums">{user.phone || "—"}</TableCell>
                    <TableCell>{roleLabels[user.role] || "نامشخص"}</TableCell>
                    <TableCell>{statusLabels[user.status] || "—"}</TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Pagination pathname="/admin/users" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} query={{ role, q: search }} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="w-full sm:w-auto"><Link href="/admin/doctors/new">ایجاد پزشک</Link></Button>
        <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/admin/centers/new">ایجاد مرکز درمانی</Link></Button>
      </div>
    </div>
  );
}
