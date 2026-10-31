import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { CommandButton } from "@/components/care/ActionControls";
import { getAdminCenters } from "@/features/centers/queries";
import { CENTER_TYPES, CENTER_TYPE_OPTIONS } from "@/lib/centers/config";
export const metadata={title:"مراکز درمانی"};
export const dynamic="force-dynamic";
export default async function CentersPage({searchParams}) {
 const {type}=await searchParams;
 const centers=await getAdminCenters(type);
 return <div className="space-y-6"><PageHeader title="مراکز درمانی" description="نوع مرکز، پنل اختصاصی و وضعیت دسترسی هر حساب را مدیریت کنید." actions={<Button asChild><Link href="/admin/centers/new">ایجاد مرکز درمانی</Link></Button>} />
  <form className="flex flex-wrap items-end gap-3"><label className="space-y-2 text-sm"><span className="block">نوع مرکز</span><select name="type" defaultValue={type||""} className="min-h-11 rounded-xl border bg-card px-3"><option value="">همهٔ مراکز</option>{CENTER_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><Button variant="outline" type="submit">نمایش مراکز</Button><Button variant="ghost" asChild><Link href="/admin/laboratories/branches">مدیریت شعب آزمایشگاه‌ها</Link></Button></form>
  <div className="grid gap-4 xl:grid-cols-2">{centers.map(c=>{const lp=Array.isArray(c.laboratory_profiles)?c.laboratory_profiles[0]:c.laboratory_profiles;const profile=Array.isArray(lp?.profiles)?lp.profiles[0]:lp?.profiles;return <article key={c.profile_id} className="space-y-4 rounded-2xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{c.display_name}</h2><span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{CENTER_TYPES[c.center_type]?.label}</span></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">مسئول حساب</dt><dd className="mt-1">{profile?.full_name||"—"}</dd></div><div><dt className="text-muted-foreground">نام کاربری</dt><dd className="mt-1"><bdi>{profile?.phone||"—"}</bdi></dd></div><div><dt className="text-muted-foreground">شمارهٔ مجوز</dt><dd className="mt-1"><bdi>{lp?.license_number||"—"}</bdi></dd></div><div><dt className="text-muted-foreground">وضعیت حساب</dt><dd className="mt-1">{c.is_active?"فعال":"دسترسی متوقف"}</dd></div></dl><div className="flex flex-wrap gap-3"><CommandButton action="center.status" payload={{id:c.profile_id,is_active:!c.is_active}}>{c.is_active?"توقف دسترسی مرکز":"فعال‌کردن دسترسی"}</CommandButton>{c.center_type==="laboratory"&&<Button asChild variant="ghost"><Link href={"/admin/laboratories/"+c.profile_id}>جزئیات آزمایشگاه</Link></Button>}</div></article>})}</div>
  {!centers.length&&<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">مرکزی با این مشخصات ثبت نشده است.</p>}
 </div>;
}
