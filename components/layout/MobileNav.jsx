"use client";

import { useSessionUser } from "@/components/providers/SessionProvider";
import { NAVIGATION_BY_ROLE } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";
import Brand from "@/components/brand/Brand";

/** @param {{ onNavigate: () => void }} props */
export default function MobileNav({ onNavigate }) {
  const user = useSessionUser();
  const items = NAVIGATION_BY_ROLE[user?.role] ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-24 shrink-0 items-center border-b px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNav items={items} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
