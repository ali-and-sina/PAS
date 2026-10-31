"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSessionUser } from "@/components/providers/SessionProvider";
import {
  getWorkspaceNavigation,
  NOTIFICATIONS_HREF_BY_ROLE,
  getWorkspaceBrand,
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
  const items = getWorkspaceNavigation(user);
  const activeItem = getActiveNavigationItem(pathname, items);
  const current = activeItem || (
    pathname.endsWith("/settings") || pathname.endsWith("/profile")
      ? {
          href: pathname,
          label: pathname.endsWith("/profile") ? "پروفایل" : "تنظیمات حساب",
        }
      : null
  );
  const notificationsHref = NOTIFICATIONS_HREF_BY_ROLE[user?.role] ?? "#";

  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-6 lg:min-h-20 lg:px-8">
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>

        <SheetContent
          id="mobile-workspace-menu"
          side="right"
          className="w-[min(88vw,320px)] p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector("[data-mobile-menu-trigger]")?.focus();
          }}
          closeButtonClassName="left-4 right-auto"
        >
          <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
          <SheetDescription className="sr-only">
            دسترسی به بخش‌های فضای کاری شما
          </SheetDescription>
          <MobileNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
        <Brand compact />
        <span className="max-w-[6.5rem] truncate border-s ps-2 text-xs text-muted-foreground sm:max-w-[10rem]">
          {current?.label || getWorkspaceBrand(user)?.label || "پاس"}
        </span>
      </div>
      <nav
        aria-label="مسیر صفحه"
        className="hidden min-w-0 items-center gap-2 text-sm lg:flex"
      >
        <span className="shrink-0 text-muted-foreground">
          فضای {getWorkspaceBrand(user)?.label || "کاربری"}
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

      <div className="ms-auto flex shrink-0 items-center gap-1">
        {notificationsHref !== "#" && (
          <NotificationBell href={notificationsHref} />
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
