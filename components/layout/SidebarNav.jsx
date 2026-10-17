"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function matchesPath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveHref(pathname, items) {
  return items.reduce((bestHref, item) => {
    if (!matchesPath(pathname, item.href)) return bestHref;
    if (!bestHref || item.href.length > bestHref.length) return item.href;
    return bestHref;
  }, null);
}

/**
 * @param {{ items: {href:string,label:string,icon:import("react").ComponentType}[], onNavigate?: () => void }} props
 */
export default function SidebarNav({ items, onNavigate }) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, items);

  return (
    <nav aria-label="ناوبری اصلی" className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-primary"
                : "text-foreground/80 hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
