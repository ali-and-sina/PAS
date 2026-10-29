"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSessionUser } from "@/components/providers/SessionProvider";
import {
  NAVIGATION_BY_ROLE,
  NOTIFICATIONS_HREF_BY_ROLE,
  ROLE_BRAND,
} from "@/lib/constants/navigation";
import { getActiveNavigationItem } from "@/lib/navigation";
import Brand from "@/components/brand/Brand";
import MobileNav from "./MobileNav";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

/** @param {{ mobileOpen: boolean, onMobileOpenChange: (open: boolean) => void }} props */
export default function Header({ mobileOpen, onMobileOpenChange }) {
  const user = useSessionUser();
  const pathname = usePathname();
  const items = NAVIGATION_BY_ROLE[user?.role] ?? [];
  const current = getActiveNavigationItem(pathname, items);
  const notificationsHref = NOTIFICATIONS_HREF_BY_ROLE[user?.role] ?? "#";

  return (
    <header className="sticky top-0 z-40 flex min-h-[80px] items-center gap-[8px] border-b bg-card/95 px-[16px] backdrop-blur sm:px-6 lg:px-8">
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-72 p-0"
          closeButtonClassName="left-4 right-auto"
        >
          <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
          <SheetDescription className="sr-only">
            دسترسی به بخش‌های فضای کاری شما
          </SheetDescription>
          <MobileNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>

      {/* <Link
        href={items[0]?.href || "/"}
        className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="پاس، صفحه اصلی"
      >
        <Brand compact />
      </Link> */}

      <nav
        aria-label="مسیر صفحه"
        className="hidden min-w-0 items-center gap-2 text-sm lg:flex"
      >
        <span className="shrink-0 text-muted-foreground">
          فضای {ROLE_BRAND[user?.role]?.label || "کاربری"}
        </span>
        {current && (
          <>
            <ChevronLeft
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Link
              href={current.href}
              className="truncate font-medium hover:text-primary"
              aria-current={pathname === current.href ? "page" : undefined}
            >
              {current.label}
            </Link>
          </>
        )}
        {current && current.href !== pathname && (
          <>
            <ChevronLeft
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span aria-current="page" className="text-muted-foreground">
              جزئیات
            </span>
          </>
        )}
      </nav>

      <div className="ms-auto flex items-center gap-1.5">
        {notificationsHref !== "#" && (
          <NotificationBell href={notificationsHref} />
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
