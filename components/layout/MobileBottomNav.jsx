"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { getWorkspaceNavigation } from "@/lib/constants/navigation";
import { getActiveNavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const destinations = {
  patient: [["/patient/dashboard", "خانه"], ["/patient/medical-services", "مراکز درمانی"], ["/patient/consultations", "ویزیت آنلاین"], ["/patient/health-record", "پرونده"]],
  doctor: [["/doctor/dashboard", "خانه"], ["/doctor/patients", "بیماران"], ["/doctor/medical-services", "مراکز درمانی"], ["/doctor/follow-ups", "پیگیری‌ها"]],
  laboratory: [["/lab/dashboard", "خانه"], ["/lab/orders", "پذیرش"], ["/lab/intake/scan", "اسکن کد"], ["/lab/results", "نتایج"]],
  admin: [["/admin", "مدیریت"], ["/admin/users", "کاربران"], ["/admin/doctors", "پزشکان"], ["/admin/centers", "مراکز"]],
};

export default function MobileBottomNav({ onOpenMenu, menuOpen }) {
  const user = useSessionUser();
  const pathname = usePathname();
  const items = getWorkspaceNavigation(user);
  const active = getActiveNavigationItem(pathname, items)?.href;
  const quick = user?.role === "medical_center" ? items.slice(0,4).map(item=>[item.href, item.href.endsWith("/dashboard") ? "خانه" : item.href.endsWith("/requests") ? "پذیرش" : item.href.endsWith("/calendar") ? "تقویم" : "گزارش‌ها"]) : destinations[user?.role];
  const entries = (quick || []).map(([href, label]) => ({ ...items.find(item => item.href === href), href, label }));
  return (
    <nav aria-label="دسترسی سریع موبایل" className="pas-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card px-1 pt-1.5 shadow-[0_-4px_18px_hsl(var(--foreground)/0.04)] lg:hidden">
      {entries.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-xs transition-colors", active === href ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}><Icon className="size-[20px]" aria-hidden="true" /><span className="line-clamp-2 max-w-full break-words px-0.5 text-center leading-4">{label}</span></Link>)}
      <button type="button" data-mobile-menu-trigger aria-controls="mobile-workspace-menu" onClick={onOpenMenu} aria-label="نمایش همه بخش‌ها" aria-expanded={menuOpen} aria-haspopup="dialog" className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-xs text-muted-foreground hover:bg-muted"><LayoutGrid className="size-5" aria-hidden="true" /><span>بخش‌ها</span></button>
    </nav>
  );
}
