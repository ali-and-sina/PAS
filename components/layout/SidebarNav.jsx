"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getActiveNavigationItem } from "@/lib/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * @param {{ items: {href:string,label:string,icon:import("react").ComponentType}[], onNavigate?: () => void, collapsed?: boolean }} props
 */
export default function SidebarNav({ items, onNavigate, collapsed = false }) {
  const pathname = usePathname();
  const activeHref = getActiveNavigationItem(pathname, items)?.href;

  return (
    <nav aria-label="ناوبری اصلی" className="space-y-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        const link = (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "relative flex min-h-12 items-center rounded-xl text-sm font-medium transition-[color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed ? "justify-center px-2" : "gap-3 px-3.5 py-3",
              active
                ? "bg-primary/10 font-semibold text-primary before:absolute before:inset-y-3 before:start-0 before:w-[0.1875rem] before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
            <span className={cn("min-w-0 leading-6", collapsed && "sr-only")}>{label}</span>
          </Link>
        );

        if (!collapsed) return link;

        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="left" align="center">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
