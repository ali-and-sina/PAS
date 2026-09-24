"use client";

import { useSessionUser } from "@/components/providers/SessionProvider";
import { NAVIGATION_BY_ROLE } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";

/** @param {{ onNavigate: () => void }} props */
export default function MobileNav({ onNavigate }) {
  const user = useSessionUser();
  const items = NAVIGATION_BY_ROLE[user?.role] ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <span className="text-lg font-semibold text-primary">پزشک‌یار</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav items={items} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
