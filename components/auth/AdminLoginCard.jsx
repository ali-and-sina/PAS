"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import visualStyles from "./auth-card.module.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdminWithPassword } from "@/features/auth/admin-actions";
import { loginTestUser } from "@/features/auth/test-actions";
import { resolvePostLoginTarget } from "@/lib/auth";

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "کد پرسنلی یا رمز عبور نادرست است.",
  SERVER_ERROR: "ورود با مشکل مواجه شد. لطفاً دوباره تلاش کنید.",
};

export default function AdminLoginCard({ next = null, isTestLoginEnabled = false }) {
  const router = useRouter();
  const [personnelCode, setPersonnelCode] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testAccessCode, setTestAccessCode] = useState("");
  const [testPending, setTestPending] = useState(false);
  const [testError, setTestError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    setError("");
    setPending(true);
    try {
      const result = await loginAdminWithPassword({
        personnelCode,
        password,
      });

      if (!result?.ok) {
        setError(ERROR_MESSAGES[result?.code] ?? ERROR_MESSAGES.SERVER_ERROR);
        return;
      }

      router.replace(
        resolvePostLoginTarget({ redirectTo: result.redirectTo, next }),
      );
      router.refresh();
    } catch {
      setError(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function handleTestLogin() {
    if (testPending) return;
    if (!testAccessCode) {
      setTestError("کد دسترسی تست را وارد کنید.");
      return;
    }

    setTestError("");
    setTestPending(true);
    try {
      const result = await loginTestUser({
        identifier: "admin",
        password: testAccessCode,
        loginContext: "admin",
      });

      if (!result?.ok) {
        setTestError(
          result?.code === "NOT_AVAILABLE"
            ? "ورود تست در تنظیمات سرور فعال نیست."
            : "ورود تست انجام نشد؛ کد دسترسی یا حساب تست در پروژهٔ توسعه تنظیم نشده است.",
        );
        return;
      }

      router.replace(
        resolvePostLoginTarget({ redirectTo: result.redirectTo, next }),
      );
      router.refresh();
    } catch {
      setTestError("ورود تست با مشکل مواجه شد.");
    } finally {
      setTestPending(false);
    }
  }

  return (
    <Card className={`relative w-full max-w-md overflow-hidden rounded-[1.65rem] border border-border/70 bg-card/95 shadow-[0_24px_70px_-38px_hsl(var(--primary)/0.42)] backdrop-blur-xl`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
      <CardHeader className="space-y-3 px-6 pb-5 pt-8 text-center sm:px-8 sm:pt-9">
        <div className="mb-1 flex flex-col items-center gap-3">
          <div
            className={`${visualStyles.brandMark} relative flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm`}
          >
            <ShieldCheck
              className="size-6"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-card bg-emerald-400"
            />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.055] px-3 py-1 text-[11px] font-medium text-primary">
            دسترسی امن مدیران سامانه
          </span>
        </div>
        <h1 className="text-[1.65rem] font-semibold tracking-tight sm:text-3xl">
          ورود مدیر سامانه
        </h1>
        <CardDescription className="mx-auto max-w-xs leading-7">
          کد پرسنلی و رمز عبور حساب مدیریتی خود را وارد کنید.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pb-7 pt-1 sm:px-8 sm:pb-8">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="admin-personnel-code">کد پرسنلی</Label>
            <Input
              id="admin-personnel-code"
              name="personnelCode"
              dir="ltr"
              autoComplete="username"
              inputMode="text"
              placeholder="ADM-0001"
              value={personnelCode}
              onChange={(event) => setPersonnelCode(event.target.value)}
              disabled={pending}
              required
              maxLength={20}
              className="h-12 rounded-xl bg-background/70 transition-[border-color,box-shadow,background-color] duration-200 focus-visible:bg-background motion-reduce:transition-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="admin-password">رمز عبور</Label>
            <Input
              id="admin-password"
              name="password"
              dir="ltr"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              required
              maxLength={1024}
              className="h-12 rounded-xl bg-background/70 transition-[border-color,box-shadow,background-color] duration-200 focus-visible:bg-background motion-reduce:transition-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="h-12 w-full rounded-xl font-medium shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:translate-y-0 motion-reduce:transition-none" disabled={pending} aria-busy={pending}>
            {pending ? "در حال بررسی اطلاعات..." : "ورود به پنل مدیریت"}
          </Button>
        </form>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          دسترسی فقط پس از تأیید حساب مدیریتی در سامانه انجام می‌شود.
        </p>

        {isTestLoginEnabled && (
          <div className="border-t border-border/70 pt-5">
            {!showTestLogin ? (
              <button
                type="button"
                className="mx-auto flex min-h-9 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted/70 hover:text-foreground motion-reduce:transition-none"
                onClick={() => setShowTestLogin(true)}
              >
                ورود تست محیط توسعه <ArrowRight className="size-3" aria-hidden="true" />
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                <Label htmlFor="admin-test-access-code">کد دسترسی تست</Label>
                <Input
                  id="admin-test-access-code"
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  value={testAccessCode}
                  onChange={(event) => {
                    setTestAccessCode(event.target.value);
                    setTestError("");
                  }}
                  disabled={testPending}
                  className="h-11 rounded-xl bg-background/80"
                />
                {testError && (
                  <p className="text-xs text-destructive" role="alert">
                    {testError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-11 flex-1 rounded-xl transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 motion-reduce:transition-none"
                    onClick={handleTestLogin}
                    disabled={testPending}
                  >
                    {testPending ? "در حال ورود..." : "ورود تست"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => {
                      setShowTestLogin(false);
                      setTestError("");
                    }}
                    disabled={testPending}
                  >
                    بستن
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
