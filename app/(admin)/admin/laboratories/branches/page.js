import Link from "next/link";
import { Building2, UsersRound } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import LaboratoryBranchForm from "@/features/laboratory-directory/components/LaboratoryBranchForm";
import LaboratoryBranchMemberForm from "@/features/laboratory-directory/components/LaboratoryBranchMemberForm";
import { getAdminLaboratoryAccountChoices, getAdminLaboratoryBranches, getAdminLaboratoryBranchMembers, getAdminLaboratoryOrganizations } from "@/features/laboratory-directory/admin-queries";

export const metadata = { title: "مدیریت شعب آزمایشگاه" };
export const dynamic = "force-dynamic";

export default async function AdminLaboratoryBranchesPage() {
  const organizations = await getAdminLaboratoryOrganizations();
  const branches = await getAdminLaboratoryBranches();
  const [accounts, memberLists] = await Promise.all([
    getAdminLaboratoryAccountChoices(),
    Promise.all(branches.map((branch) => getAdminLaboratoryBranchMembers(branch.branch_id))),
  ]);
  const membersByBranch = new Map(branches.map((branch, index) => [branch.branch_id, memberLists[index] || []]));

  return <div className="space-y-6">
    <PageHeader title="مدیریت شعب آزمایشگاه" description="آدرس و امکانات هر شعبه را ثبت کنید و حساب‌های آزمایشگاهی موجود را به شعبهٔ صحیح متصل کنید." actions={<Button asChild variant="outline"><Link href="/admin/laboratories">بازگشت به آزمایشگاه‌ها</Link></Button>} />
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">ایجاد شعبه</h2><p className="mt-1 text-sm text-muted-foreground">شعبه باید به یک سازمان آزمایشگاهی ثبت‌شده متصل باشد.</p></div><LaboratoryBranchForm organizations={organizations} /></section>
    <section className="space-y-4"><div><h2 className="text-lg font-semibold">شعبه‌های ثبت‌شده</h2><p className="mt-1 text-sm text-muted-foreground">برای نمایش شعبه به بیمار، آن را فعال و شهر و نشانی‌اش را تکمیل کنید.</p></div>
      {branches.length ? branches.map((branch) => {
        const currentMembers = membersByBranch.get(branch.branch_id) || [];
        const memberships = new Map(currentMembers.map((member) => [member.profile_id, member]));
        const availableAccounts = accounts.filter((account) => account.organization_id === branch.organization_id);
        return <article key={branch.branch_id} className="space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{branch.display_name}</h3><p className="mt-1 text-xs text-muted-foreground">{branch.organization_name}{branch.city ? ` · ${branch.city}` : " · شهر ثبت نشده"}</p></div><span className={`rounded-full px-3 py-1 text-xs ${branch.is_active ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{branch.is_active ? "فعال" : "غیرفعال"}</span></div>
          <details><summary className="cursor-pointer text-sm font-medium">ویرایش اطلاعات شعبه</summary><div className="mt-3"><LaboratoryBranchForm organizations={organizations} branch={branch} compact /></div></details>
          <div className="space-y-3"><div className="flex items-center gap-2"><UsersRound className="size-4 text-primary" aria-hidden="true" /><h4 className="font-medium">دسترسی کارکنان این شعبه</h4></div>
            {availableAccounts.length ? <div className="space-y-2">{availableAccounts.map((account) => <LaboratoryBranchMemberForm key={account.id} branchId={branch.branch_id} account={account} membership={memberships.get(account.id) || null} />)}</div> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">برای این سازمان حساب آزمایشگاهی تعریف نشده است. ابتدا از صفحه آزمایشگاه‌ها یک حساب بسازید.</p>}
          </div>
        </article>;
      }) : <EmptyState icon={Building2} title="هنوز شعبه‌ای ثبت نشده است" description="پس از ایجاد سازمان آزمایشگاهی، از فرم بالا اولین شعبه را بسازید." />}
    </section>
  </div>;
}
