"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import visualStyles from "./auth-card.module.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

import { auth } from "@/lib/auth/client";

import { resolvePostLoginTarget } from "@/lib/auth";

import {
  getFieldErrors,
  normalizeDigits,
  toLocalMobile,
} from "@/lib/utils/validation";

import { LOGIN_ROLE_CONFIG, getAuthErrorMessage } from "@/features/auth/config";

import {
  buildLoginIdentitySchema,
  otpCodeSchema,
} from "@/features/auth/schemas";

import RoleSelector from "./RoleSelector";
import IdentityForm from "./IdentityForm";
import OtpForm from "./OtpForm";

const HEADING_ID = "login-heading";

export default function LoginCard({
  next = null,
  isDevelopmentAuth = false,
  isTestLoginEnabled = true,
  fixedRole = null,
}) {
  const router = useRouter();

  const [step, setStep] = useState(fixedRole ? "identity" : "role");

  const [role, setRole] = useState(fixedRole);

  const [values, setValues] = useState({
    identifier: "",
    phone: "",
  });

  const [submitted, setSubmitted] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});

  const [focusRequest, setFocusRequest] = useState(0);

  const [formError, setFormError] = useState(null);

  const [code, setCode] = useState("");

  const [pending, setPending] = useState(false);

  const [resendCount, setResendCount] = useState(0);

  const [done, setDone] = useState(false);

  const [showTestLogin, setShowTestLogin] = useState(false);

  const [testIdentifier, setTestIdentifier] = useState("");

  const [testPassword, setTestPassword] = useState("");

  const [testPending, setTestPending] = useState(false);

  const [testError, setTestError] = useState("");

  const config = role ? LOGIN_ROLE_CONFIG[role] : null;

  function handleSelectRole(nextRole) {
    if (nextRole !== role) {
      setValues((prev) => ({
        ...prev,
        identifier: "",
      }));
    }

    setRole(nextRole);
    setFieldErrors({});
    setFormError(null);
    setStep("identity");
  }

  function handleFieldChange(field, value) {
    setValues((prev) => ({
      ...prev,
      [field]: normalizeDigits(value),
    }));

    setFieldErrors((prev) =>
      prev[field]
        ? {
            ...prev,
            [field]: undefined,
          }
        : prev,
    );
  }

  function handleBackToRole() {
    setFieldErrors({});
    setFormError(null);
    setStep("role");
  }

  function handleBackToIdentity() {
    setCode("");
    setFormError(null);
    setStep("identity");
  }

  async function handleIdentitySubmit() {
    if (pending || !role) {
      return;
    }

    const parsed = buildLoginIdentitySchema(role).safeParse(values);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      setFocusRequest((n) => n + 1);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const result = await auth.requestLoginOtp({
        role,
        ...parsed.data,
      });

      if (result?.ok) {
        setSubmitted(parsed.data);
        setCode("");
        setResendCount((n) => n + 1);
        setStep("otp");
      } else {
        setFormError(getAuthErrorMessage(result?.code));
      }
    } catch {
      setFormError(getAuthErrorMessage("SERVER_ERROR"));
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (pending || !role || !submitted) {
      return;
    }

    setFormError(null);
    setPending(true);

    try {
      const result = await auth.requestLoginOtp({
        role,
        ...submitted,
      });

      if (result?.ok) {
        setCode("");
        setResendCount((n) => n + 1);
        toast.success("کد جدید درخواست شد.");
      } else {
        setFormError(getAuthErrorMessage(result?.code));
      }
    } catch {
      setFormError(getAuthErrorMessage("SERVER_ERROR"));
    } finally {
      setPending(false);
    }
  }

  async function handleTestLogin() {
    if (testPending) {
      return;
    }

    const identifier = testIdentifier.trim();
    const password = testPassword;

    if (!identifier || !password) {
      setTestError("شناسه و رمز ورود تست را وارد کنید.");
      return;
    }

    // ادمین نباید از لاگین عمومی وارد شود.
    if (fixedRole !== "admin" && identifier.toLowerCase() === "admin") {
      setTestError("ورود مدیر فقط از صفحه اختصاصی مدیریت امکان‌پذیر است.");
      return;
    }

    // اگر این LoginCard برای مدیر است، فقط شناسه مدیر مجاز است.
    if (fixedRole === "admin" && identifier.toLowerCase() !== "admin") {
      setTestError("شناسه ورود مدیر نادرست است.");
      return;
    }

    setTestError("");
    setTestPending(true);

    try {
      const result = await auth.loginTestUser({
        identifier,
        password,
      });

      if (result?.ok) {
        setDone(true);

        router.replace(
          resolvePostLoginTarget({
            redirectTo: result.redirectTo,
            next,
          }),
        );

        router.refresh();

        return;
      }

      setTestError(
        result?.code === "NOT_AVAILABLE"
          ? "ورود تست در تنظیمات سرور فعال نیست."
          : "کد دسترسی تست اشتباه است یا حساب آزمایشی در پروژهٔ توسعه ساخته نشده است.",
      );
    } catch {
      setTestError("ورود تست با مشکل مواجه شد.");
    } finally {
      setTestPending(false);
    }
  }

  async function handleVerify() {
    if (pending || !role || !submitted) {
      return;
    }

    const parsed = otpCodeSchema.safeParse(code);

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? getAuthErrorMessage("WRONG_OTP"),
      );

      return;
    }

    setFormError(null);
    setPending(true);

    try {
      const result = await auth.verifyLoginOtp({
        role,
        ...submitted,
        code: parsed.data,
      });

      if (result?.ok) {
        setDone(true);

        router.replace(
          resolvePostLoginTarget({
            redirectTo: result.redirectTo,
            next,
            isNewUser: result.isNewUser === true,
          }),
        );

        router.refresh();

        return;
      }

      setCode("");

      setFormError(getAuthErrorMessage(result?.code));

      if (
        result?.code === "INVALID_INPUT" ||
        result?.code === "USER_NOT_FOUND"
      ) {
        setStep("identity");
      }
    } catch {
      setFormError(getAuthErrorMessage("SERVER_ERROR"));
    }

    setPending(false);
  }

  const header = {
    role: {
      title: "ورود به پاس",
      description: "نقش خود را انتخاب کنید.",
    },

    identity: {
      title: `ورود ${config?.label ?? ""}`.trim(),
      description: "برای دریافت کد ورود، مشخصات خود را وارد کنید.",
    },

    otp: {
      title: "کد تأیید",

      description: (
        <>
          کد ورود برای شماره{" "}
          <bdi dir="ltr" className="tabular-nums">
            {toLocalMobile(submitted?.phone)}
          </bdi>{" "}
          درخواست شد.
        </>
      ),
    },
  }[step];

  const BrandIcon = fixedRole === "admin" ? ShieldCheck : Activity;

  return (
    <Card
      className={`relative w-full max-w-md overflow-hidden rounded-[1.65rem] border border-border/70 bg-card/95 shadow-[0_24px_70px_-38px_hsl(var(--primary)/0.42)] backdrop-blur-xl`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />

      <CardHeader className="space-y-3 px-6 pb-5 pt-8 text-center sm:px-8 sm:pt-9">
        <div className="mb-1 flex flex-col items-center gap-3">
          <div
            className={`${visualStyles.brandMark} relative flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm`}
          >
            <BrandIcon
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
            پلتفرم ارزیابی سلامت
          </span>
        </div>

        <h1
          id={HEADING_ID}
          className="text-[1.65rem] font-semibold tracking-tight sm:text-3xl"
        >
          {header.title}
        </h1>

        <CardDescription className="mx-auto max-w-xs leading-7">
          {header.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-7 pt-1 sm:px-8 sm:pb-8">
        {done ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-6 text-sm"
          >
            <CheckCircle2
              className="size-4 text-status-normal"
              aria-hidden="true"
            />
            ورود انجام شد. در حال انتقال...
          </div>
        ) : (
          <>
            <div key={step} className={visualStyles.stepEnter}>
              {step === "role" && <RoleSelector onSelect={handleSelectRole} />}

              {step === "identity" && config && (
                <IdentityForm
                  config={config}
                  values={values}
                  errors={fieldErrors}
                  formError={formError}
                  pending={pending}
                  focusRequest={focusRequest}
                  labelledBy={HEADING_ID}
                  onChange={handleFieldChange}
                  onSubmit={handleIdentitySubmit}
                  onBack={fixedRole ? null : handleBackToRole}
                />
              )}

              {step === "otp" && (
                <OtpForm
                  code={code}
                  error={formError}
                  pending={pending}
                  isDevelopmentAuth={isDevelopmentAuth}
                  resendCount={resendCount}
                  labelledBy={HEADING_ID}
                  onCodeChange={setCode}
                  onSubmit={handleVerify}
                  onBack={handleBackToIdentity}
                  onResend={handleResend}
                />
              )}
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              با ورود، شرایط استفاده و سیاست حریم خصوصی را می‌پذیرید.
            </p>

            {isTestLoginEnabled && (
              <div className="mt-6 border-t border-border/70 pt-4">
                {!showTestLogin ? (
                  <button
                    type="button"
                    className="mx-auto inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    onClick={() => setShowTestLogin(true)}
                  >
                    ورود تست
                  </button>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="text-center text-xs text-muted-foreground">
                      ورود موقت برای تست داشبوردها
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["بیمار", "1272511677", "patient"],
                        ["پزشک", "12345", "doctor"],
                        ["آزمایشگاه", "LAB-1234", "laboratory"],
                        ["مدیر", "admin", "admin"],
                      ]
                        .filter(([, , itemRole]) => {
                          if (fixedRole === "admin") {
                            return itemRole === "admin";
                          }

                          return itemRole !== "admin";
                        })
                        .map(([label, identifier]) => (
                          <button
                            key={identifier}
                            type="button"
                            className="min-h-10 rounded-xl border border-border/80 bg-background/70 px-2 py-2 text-xs transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/60 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                            onClick={() => {
                              setTestIdentifier(identifier);
                              setTestError("");
                            }}
                            disabled={testPending}
                          >
                            {label}
                          </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                      <input
                        dir="ltr"
                        value={testIdentifier}
                        onChange={(event) => {
                          setTestIdentifier(event.target.value);
                          setTestError("");
                        }}
                        placeholder="شناسه تست"
                        autoComplete="off"
                        className="h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 motion-reduce:transition-none"
                        disabled={testPending}
                      />

                      <input
                        dir="ltr"
                        type="password"
                        value={testPassword}
                        onChange={(event) => {
                          setTestPassword(event.target.value);
                          setTestError("");
                        }}
                        placeholder="رمز عبور تست: 1234"
                        autoComplete="off"
                        className="h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 motion-reduce:transition-none"
                        disabled={testPending}
                      />

                      {testError && (
                        <p className="text-xs text-destructive">{testError}</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="h-11 flex-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                          onClick={handleTestLogin}
                          disabled={testPending}
                        >
                          {testPending ? "در حال ورود..." : "ورود تست"}
                        </button>

                        <button
                          type="button"
                          className="h-11 rounded-xl border border-border/80 px-4 text-sm transition-colors duration-200 hover:bg-accent/60 disabled:opacity-50 motion-reduce:transition-none"
                          onClick={() => {
                            setShowTestLogin(false);
                            setTestError("");
                          }}
                          disabled={testPending}
                        >
                          بستن
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
