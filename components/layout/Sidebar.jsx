"use client";

import Link from "next/link";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { getWorkspaceNavigation, getWorkspaceBrand } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";
import Brand from "@/components/brand/Brand";
import { cn } from "@/lib/utils";

/** Desktop navigation rail. The mobile drawer and bottom navigation live in Header/AppShell. */
export default function Sidebar({ collapsed = false }) {
  const user = useSessionUser();
  const items = getWorkspaceNavigation(user);
  const homeHref = items[0]?.href || "/";
  const workspace = getWorkspaceBrand(user)?.label || "کاربر";

  return (
    <aside
      aria-label="ناوبری فضای کاری"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-e bg-card transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[4.75rem]" : "w-64 xl:w-72",
      )}
    >
      <div className={cn("flex h-20 shrink-0 items-center border-b", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href={homeHref} aria-label="پاس، صفحه اصلی" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand compact={collapsed} />
        </Link>
      </div>

      {!collapsed ? (
        <div className="mx-4 my-4 rounded-xl border bg-muted/40 px-3.5 py-3">
          <p className="text-xs text-muted-foreground">فضای کاری</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{workspace}</p>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3.5")}>
        <SidebarNav items={items} collapsed={collapsed} />
      </div>

      <div className={cn("shrink-0 border-t py-4 text-xs leading-6 text-muted-foreground", collapsed ? "px-2 text-center" : "px-5")}>
        {collapsed ? <span aria-label="مراقبت هماهنگ" title="مراقبت هماهنگ">پاس</span> : "مراقبت هماهنگ، در یک نگاه"}
      </div>
    </aside>
  );
}
