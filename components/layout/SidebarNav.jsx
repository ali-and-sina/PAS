"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getActiveNavigationItem } from "@/lib/navigation";

/**
 * @param {{ items: {href:string,label:string,icon:import("react").ComponentType}[], onNavigate?: () => void }} props
 */
export default function SidebarNav({ items, onNavigate }) {
  const pathname = usePathname();
  const activeHref = getActiveNavigationItem(pathname, items)?.href;

  return (
    <nav aria-label="ناوبری اصلی" className="space-y-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary before:absolute before:inset-y-3 before:start-0 before:w-[3px] before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            <span className="min-w-0 leading-6">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
