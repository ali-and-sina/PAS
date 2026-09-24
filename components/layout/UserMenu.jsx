"use client";

import { useState, useTransition } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/auth/client";
import { LOGIN_PATH } from "@/lib/auth";
import { ROLE_BRAND } from "@/lib/constants/navigation";

function initialsOf(name) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "؟";
  return trimmed[0];
}

/** @param {{ user: object }} props */
export default function UserMenu({ user }) {
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);
  const roleLabel = ROLE_BRAND[user?.role]?.label ?? "";

  function handleSignOut() {
    setSigningOut(true);
    startTransition(async () => {
      try {
        await auth.signOut();
        window.location.assign(LOGIN_PATH);
      } catch {
        toast.error("خروج با مشکل مواجه شد. دوباره تلاش کنید.");
        setSigningOut(false);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto gap-2 rounded-full px-2 py-1.5"
        >
          <Avatar className="size-8">
            <AvatarImage src={user?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-accent text-sm text-primary">
              {initialsOf(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-start sm:block">
            <span className="block max-w-32 truncate text-sm font-medium leading-tight">
              {user?.full_name?.trim() || "کاربر"}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground">
              {roleLabel}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {user?.full_name?.trim() || "کاربر مهمان"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="#" className="cursor-not-allowed opacity-60">
            <UserIcon aria-hidden="true" />
            تنظیمات حساب
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleSignOut();
          }}
          disabled={pending || signingOut}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut aria-hidden="true" />
          {signingOut ? "در حال خروج..." : "خروج از حساب"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
