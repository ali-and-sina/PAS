"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { NAVIGATION_BY_ROLE } from "@/lib/constants/navigation";
import { getActiveNavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const destinations = {
  patient: [["/patient/dashboard", "خانه"], ["/patient/results", "نتایج"], ["/patient/lab-orders", "آزمایش‌ها"], ["/patient/health-record", "پرونده"]],
  doctor: [["/doctor/dashboard", "خانه"], ["/doctor/patients", "بیماران"], ["/doctor/lab-orders", "آزمایش‌ها"], ["/doctor/follow-ups", "پیگیری‌ها"]],
  laboratory: [["/lab/dashboard", "خانه"], ["/lab/orders", "پذیرش"], ["/lab/intake/scan", "اسکن کد"], ["/lab/results", "نتایج"]],
  admin: [["/admin", "مدیریت"], ["/admin/users", "کاربران"], ["/admin/doctors", "پزشکان"], ["/admin/laboratories", "آزمایشگاه‌ها"]],
};

export default function MobileBottomNav({ onOpenMenu, menuOpen }) {
  const user = useSessionUser();
  const pathname = usePathname();
  const items = NAVIGATION_BY_ROLE[user?.role] || [];
  const active = getActiveNavigationItem(pathname, items)?.href;
  const entries = (destinations[user?.role] || []).map(([href, label]) => ({ ...items.find(item => item.href === href), href, label }));
  return (
    <nav aria-label="دسترسی سریع موبایل" className="pas-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card px-1 pt-2 lg:hidden">
      {entries.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-xs transition-colors", active === href ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}><Icon className="size-[20px]" aria-hidden="true" /><span className="break-words text-center leading-5">{label}</span></Link>)}
      <button type="button" onClick={onOpenMenu} aria-label="نمایش همه بخش‌ها" aria-expanded={menuOpen} aria-haspopup="dialog" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs text-muted-foreground hover:bg-muted"><Menu className="size-5" aria-hidden="true" /><span>بیشتر</span></button>
    </nav>
  );
}
