"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";

/** @param {{ mobileOpen: boolean, onMobileOpenChange: (open: boolean) => void, sidebarCollapsed: boolean, onToggleSidebar: () => void, onOpenCommandPalette: () => void, onOpenShortcuts: () => void }} props */
export default function Header({
  mobileOpen,
  onMobileOpenChange,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenCommandPalette,
  onOpenShortcuts,
}) {
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
  const workspaceLabel = getWorkspaceBrand(user)?.label || "کاربری";
  const isNestedPage = Boolean(current && current.href !== pathname);

  return (
    <header className="sticky top-0 z-40 flex min-h-16 min-w-0 items-center gap-2 border-b bg-card/95 px-2.5 backdrop-blur sm:px-4 lg:min-h-[4.5rem] lg:px-6">
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          id="mobile-workspace-menu"
          side="bottom"
          mobileBottomSheet={false}
          className="h-[min(82dvh,42.5rem)] max-h-[88dvh] w-full rounded-t-2xl rounded-b-none border-x-0 border-b-0 border-t p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector("[data-mobile-menu-trigger]")?.focus();
          }}
        >
          <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
          <SheetDescription className="sr-only">
            دسترسی به بخش‌های فضای کاری شما
          </SheetDescription>
          <MobileNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
        <Link href={items[0]?.href || "/"} className="shrink-0 lg:hidden" aria-label="پاس، صفحه اصلی">
          <Brand compact />
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
          aria-pressed={sidebarCollapsed}
          title={sidebarCollapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
        >
          {sidebarCollapsed ? <PanelRightOpen aria-hidden="true" /> : <PanelRightClose aria-hidden="true" />}
        </Button>

        <nav aria-label="مسیر صفحه" className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
          <Link
            href={items[0]?.href || "/"}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            فضای {workspaceLabel}
          </Link>
          {current ? (
            <>
              <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {current.href === pathname ? (
                <span aria-current="page" className="max-w-[28rem] truncate font-medium text-foreground">{current.label}</span>
              ) : (
                <>
                  <Link href={current.href} className="max-w-[24rem] truncate font-medium transition-colors hover:text-primary">{current.label}</Link>
                  {isNestedPage ? (
                    <>
                      <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span aria-current="page" className="text-muted-foreground">جزئیات</span>
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </nav>

        <span className="hidden min-w-0 max-w-28 truncate text-xs text-muted-foreground min-[27.5rem]:block lg:hidden">
          {current?.label || workspaceLabel}
        </span>
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-0 sm:gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenCommandPalette}
          aria-label="جستجوی صفحات و بخش‌ها"
          aria-keyshortcuts="Control+K Meta+K"
          title="جستجوی صفحات و بخش‌ها (Ctrl/⌘ K)"
          className="size-9 min-h-9 shrink-0 p-0 sm:size-10 sm:min-h-10 sm:w-auto sm:gap-2 sm:px-3"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">جستجو</span>
          <kbd dir="ltr" className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[0.625rem] text-muted-foreground lg:inline-flex">Ctrl/⌘ K</kbd>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onOpenShortcuts}
          aria-label="راهنمای میانبرهای صفحه‌کلید"
          aria-keyshortcuts="?"
          title="راهنمای میانبرها (?)"
        >
          <Keyboard className="size-5" aria-hidden="true" />
        </Button>
        {notificationsHref !== "#" ? <NotificationBell href={notificationsHref} /> : null}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
