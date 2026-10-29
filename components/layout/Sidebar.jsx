"use client";

import { useSessionUser } from "@/components/providers/SessionProvider";
import { NAVIGATION_BY_ROLE } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";
import Link from "next/link";
import Brand from "@/components/brand/Brand";
import { ROLE_BRAND } from "@/lib/constants/navigation";

/** Desktop-only rail. Hidden below `lg`; MobileNav covers small screens. */
export default function Sidebar() {
  const user = useSessionUser();
  const items = NAVIGATION_BY_ROLE[user?.role] ?? [];

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e bg-card lg:flex xl:w-72">
      <div className="flex h-24 shrink-0 items-center px-6">
        <Link href={items[0]?.href || "/"} aria-label="پاس، صفحه اصلی"><Brand /></Link>
      </div>
      <div className="mx-5 mb-5 rounded-xl border bg-muted/40 px-3.5 py-3">
        <p className="text-xs text-muted-foreground">فضای کاری</p>
        <p className="mt-0.5 text-sm font-semibold">{ROLE_BRAND[user?.role]?.label || "کاربر"}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <SidebarNav items={items} />
      </div>
      <div className="mx-5 border-t py-5 text-xs leading-6 text-muted-foreground">مراقبت هماهنگ، در یک نگاه</div>
    </aside>
  );
}
