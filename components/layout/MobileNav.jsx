"use client";

import { useSessionUser } from "@/components/providers/SessionProvider";
import { getWorkspaceNavigation } from "@/lib/constants/navigation";
import SidebarNav from "./SidebarNav";
import Brand from "@/components/brand/Brand";

/** @param {{ onNavigate: () => void }} props */
export default function MobileNav({ onNavigate }) {
  const user = useSessionUser();
  const items = getWorkspaceNavigation(user);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-5 pb-3 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
        <div className="flex h-16 items-center">
          <Brand />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SidebarNav items={items} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
