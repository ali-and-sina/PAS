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
import { Button } from "@/components/ui/button";

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
      dir="rtl"
      className="relative isolate w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 text-slate-800 shadow-[0_24px_80px_-32px_rgba(54,115,170,0.32)] backdrop-blur-xl"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 500 260"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        fill="none"
      >
        <path
          d="M350 -30 C350 75 450 40 530 110"
          stroke="#C8DCFF"
          strokeWidth="1.2"
        />
        <path
          d="M-80 180 C40 100 90 250 230 235"
          stroke="#8FD7E0"
          strokeWidth="1.2"
        />
        <circle cx="450" cy="30" r="55" fill="#EAF5FB" opacity=".45" />
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-teal-400/70 to-transparent"
      />

      <CardHeader className="space-y-3 px-6 pb-6 pt-8 text-right sm:px-9 sm:pt-10">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 text-white shadow-[0_8px_22px_-10px_rgba(20,150,170,.65)]">
            <BrandIcon
              className="size-6"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-white bg-emerald-400"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xl font-bold tracking-tight text-slate-800">
              پاس
            </div>
            <div className="text-xs text-slate-500">پلتفرم ارزیابی سلامت</div>
          </div>
        </div>

        <h1
          id={HEADING_ID}
          className="pt-2 text-2xl font-bold tracking-tight text-slate-800 sm:text-[1.8rem]"
        >
          {header.title}
        </h1>

        <CardDescription className="max-w-sm text-sm leading-7 text-slate-500">
          {header.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-8 pt-1 sm:px-9 sm:pb-10">
        {done ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600"
          >
            <CheckCircle2 className="size-5 text-teal-500" aria-hidden="true" />
            ورود انجام شد. در حال انتقال...
          </div>
        ) : (
          <>
            <div key={step} className={visualStyles.stepEnter}>
              {step === "role" && !showTestLogin && (
                <RoleSelector onSelect={handleSelectRole} />
              )}

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

            <div className="mt-7 flex items-start gap-2 border-t border-slate-100 pt-4">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-teal-600"
                aria-hidden="true"
              />
              <p className="text-xs leading-6 text-slate-500">
                اطلاعات شما با رعایت اصول امنیت و حریم خصوصی پردازش می‌شود.
              </p>
            </div>

            {isTestLoginEnabled && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                {!showTestLogin ? (
                  <button
                    type="button"
                    className="mx-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 motion-reduce:transition-none"
                    onClick={() => setShowTestLogin(true)}
                  >
                    <Activity
                      className="size-4 text-teal-600"
                      aria-hidden="true"
                    />
                    ورود تست
                  </button>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4">
                    <div className="text-center text-xs leading-6 text-slate-500">
                      ورود موقت برای بررسی بخش‌های مختلف سامانه
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
                            className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/60 disabled:opacity-50"
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
                        disabled={testPending}
                      />

                      {testError && (
                        <p
                          role="alert"
                          className="text-xs leading-5 text-destructive"
                        >
                          {testError}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="h-11 flex-1 rounded-xl bg-gradient-to-l from-teal-500 to-teal-600 px-3 text-sm font-medium text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={handleTestLogin}
                          disabled={testPending}
                          loading={testPending}
                        >
                          {testPending ? "در حال ورود..." : "ورود تست"}
                        </Button>

                        <button
                          type="button"
                          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
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
