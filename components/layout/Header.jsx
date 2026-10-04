"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { NOTIFICATIONS_HREF_BY_ROLE } from "@/lib/constants/navigation";
import MobileNav from "./MobileNav";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

/** @param {{ mobileOpen: boolean, onMobileOpenChange: (open: boolean) => void }} props */
export default function Header({ mobileOpen, onMobileOpenChange }) {
  const user = useSessionUser();
  const notificationsHref = NOTIFICATIONS_HREF_BY_ROLE[user?.role] ?? "#";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="باز کردن منو"
          onClick={() => onMobileOpenChange(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
        <SheetContent side="right" className="w-72 p-0">
          <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
          <MobileNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>

      <span className="text-base font-semibold text-primary lg:hidden">
        پزشک‌یار
      </span>

      <div className="ms-auto flex items-center gap-1.5">
        {notificationsHref !== "#" && <NotificationBell href={notificationsHref} />}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
