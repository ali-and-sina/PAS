"use client";

import { useSessionUser } from "@/components/providers/SessionProvider";
import { NAVIGATION_BY_ROLE } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";

/** Desktop-only rail. Hidden below `lg`; MobileNav covers small screens. */
export default function Sidebar() {
  const user = useSessionUser();
  const items = NAVIGATION_BY_ROLE[user?.role] ?? [];

  return (
    <aside className="hidden w-64 shrink-0 border-e bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <span className="text-lg font-semibold text-primary">پزشک‌یار</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav items={items} />
      </div>
    </aside>
  );
}
