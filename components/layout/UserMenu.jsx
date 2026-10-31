"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { centerSettings } from "@/lib/centers/config";
import { ACCOUNT_PATHS } from "@/lib/care/constants";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
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
import { getWorkspaceBrand } from "@/lib/constants/navigation";

function initialsOf(name) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "؟";
  return trimmed[0];
}

/** @param {{ user: object }} props */
export default function UserMenu({ user }) {
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);
  const settingsPath = user?.role === "medical_center" || user?.role === "laboratory"
    ? centerSettings(user)
    : ACCOUNT_PATHS[user?.role];
  const isPatient = user?.role === "patient";
  const roleLabel = getWorkspaceBrand(user)?.label ?? "";
  const accountLabel = user?.role === "medical_center" || user?.role === "laboratory"
    ? "مشخصات و تنظیمات مرکز"
    : user?.role === "admin"
      ? "اطلاعات مدیر و تنظیمات حساب"
      : "پروفایل و تنظیمات حساب";

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
          className="min-h-11 gap-2 rounded-full px-2 py-1 sm:px-2.5"
          aria-label={`منوی حساب ${user?.full_name?.trim() || "کاربر"}`}
        >
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={user?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-accent text-sm text-primary">
              {initialsOf(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium sm:hidden">حساب</span>
          <span className="hidden min-w-0 text-start sm:block">
            <span className="block max-w-32 truncate text-sm font-medium leading-tight">
              {user?.full_name?.trim() || "کاربر"}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground">
              {roleLabel}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-1rem)]">
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <span className="block truncate text-sm font-semibold text-foreground">
            {user?.full_name?.trim() || "کاربر"}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPatient && (
          <DropdownMenuItem asChild className="min-h-11 px-3">
            <Link href="/patient/profile">
              <UserRound aria-hidden="true" />
              پروفایل بیمار
            </Link>
          </DropdownMenuItem>
        )}
        {settingsPath && (
          <DropdownMenuItem asChild className="min-h-11 px-3">
            <Link href={settingsPath}>
              <Settings aria-hidden="true" />
              {isPatient ? "تنظیمات حساب کاربری" : accountLabel}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleSignOut();
          }}
          disabled={pending || signingOut}
          className="min-h-11 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          {signingOut ? <span className="pas-button-spinner" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
          {signingOut ? "در حال خروج..." : "خروج از حساب"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
