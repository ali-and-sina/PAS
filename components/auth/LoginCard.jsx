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
import Brand from "@/components/brand/Brand";

const HEADING_ID = "login-heading";

export default function LoginCard({
  next = null,
  isDevelopmentAuth = false,
  isTestLoginEnabled = false,
  fixedRole = null,
}) {
  const router = useRouter();

  const canUseTestLogin =
    process.env.NODE_ENV === "development" || isTestLoginEnabled;

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
    if (pending || !role) return;

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
    if (pending || !role || !submitted) return;

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
    if (!canUseTestLogin || testPending) return;

    const identifier = normalizeDigits(testIdentifier).trim();
    const password = testPassword;

    if (!identifier || !password) {
      setTestError("شناسه و رمز ورود آزمایشی را وارد کنید.");
      return;
    }

    if (fixedRole !== "admin" && identifier.toLowerCase() === "admin") {
      setTestError("ورود مدیر فقط از صفحه اختصاصی مدیریت امکان‌پذیر است.");
      return;
    }

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
        loginContext: fixedRole === "admin" ? "admin" : "public",
      });

      if (result?.ok) {
        setDone(true);

        window.location.replace(
          resolvePostLoginTarget({
            redirectTo: result.redirectTo,
            next,
          }),
        );

        return;
      }

      setTestError(
        result?.code === "NOT_AVAILABLE"
          ? "ورود آزمایشی در تنظیمات سرور فعال نیست."
          : result?.code === "SERVER_ERROR"
            ? "ورود آزمایشی با مشکل مواجه شد."
            : "شناسه یا رمز دسترسی آزمایشی درست نیست.",
      );
    } catch {
      setTestError("ورود آزمایشی با مشکل مواجه شد.");
    } finally {
      setTestPending(false);
    }
  }

  async function handleVerify() {
    if (pending || !role || !submitted) return;

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
    } finally {
      setPending(false);
    }
  }

  const header = {
    role: {
      title: "ورود به پاس",
      description: "برای شروع، نقش خود را انتخاب کنید.",
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

  const stepNumber =
    step === "role"
      ? 1
      : step === "identity"
        ? fixedRole
          ? 1
          : 2
        : fixedRole
          ? 2
          : 3;

  const totalSteps = fixedRole ? 2 : 3;

  return (
    <Card dir="rtl" className="w-full border-0 bg-transparent shadow-none">
      <CardHeader className="space-y-3 p-0 pb-7 text-start sm:p-0 sm:pb-7">
        <div className="mb-6 lg:hidden">
          <Brand />
        </div>

        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {fixedRole === "admin" ? "ورود مدیریت" : "ورود به حساب کاربری"}
          </span>

          <span>
            مرحله {new Intl.NumberFormat("fa-IR").format(stepNumber)} از{" "}
            {new Intl.NumberFormat("fa-IR").format(totalSteps)}
          </span>
        </div>

        <div aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              key={index}
              className={`h-1 flex-1 rounded-full ${
                index < stepNumber ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <h1
          id={HEADING_ID}
          className="pt-4 text-2xl font-bold leading-relaxed text-foreground sm:text-[1.8rem]"
        >
          {header.title}
        </h1>

        <CardDescription className="max-w-sm text-sm leading-7 text-muted-foreground">
          {header.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
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

            <div className="mt-7 flex items-start gap-2 rounded-xl bg-muted/50 p-3.5">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />

              <p className="text-xs leading-6 text-muted-foreground">
                کد ورود را فقط در همین صفحه وارد کنید و در اختیار دیگران
                نگذارید.
              </p>
            </div>

            <div className="mt-5 border-t pt-4">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                aria-expanded={showTestLogin}
                aria-controls="test-login-panel"
                onClick={() => {
                  setShowTestLogin((open) => !open);
                  setTestError("");
                }}
                disabled={testPending}
              >
                <Activity className="size-4 text-primary" aria-hidden="true" />

                {showTestLogin ? "بستن ورود آزمایشی" : "ورود آزمایشی"}
              </button>

              <div
                id="test-login-panel"
                hidden={!showTestLogin}
                className="mt-4 rounded-2xl border bg-muted/40 p-4"
              >
                {!canUseTestLogin ? (
                  <p
                    role="status"
                    className="text-sm leading-7 text-muted-foreground"
                  >
                    ورود آزمایشی در این محیط فعال نیست.
                  </p>
                ) : (
                  <form
                    className="space-y-4"
                    aria-label="ورود آزمایشی"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleTestLogin();
                    }}
                  >
                    <p className="text-sm leading-7 text-muted-foreground">
                      حساب آزمایشی را انتخاب و رمز دسترسی را وارد کنید.
                    </p>

                    <fieldset disabled={testPending} className="space-y-2">
                      <legend className="mb-2 text-sm font-medium">
                        حساب آزمایشی
                      </legend>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["بیمار", "1272511677", "patient"],
                          ["پزشک", "12345", "doctor"],
                          ["آزمایشگاه", "LAB-1234", "laboratory"],
                          ["مدیر", "admin", "admin"],
                        ]
                          .filter(([, , itemRole]) =>
                            fixedRole === "admin"
                              ? itemRole === "admin"
                              : itemRole !== "admin",
                          )
                          .map(([label, identifier]) => (
                            <Button
                              key={identifier}
                              type="button"
                              variant={
                                testIdentifier === identifier
                                  ? "secondary"
                                  : "outline"
                              }
                              aria-pressed={testIdentifier === identifier}
                              onClick={() => {
                                setTestIdentifier(identifier);
                                setTestError("");
                              }}
                            >
                              {label}
                            </Button>
                          ))}
                      </div>
                    </fieldset>

                    <div className="space-y-2">
                      <label
                        htmlFor="test-login-identifier"
                        className="block text-sm font-medium"
                      >
                        شناسهٔ آزمایشی
                      </label>

                      <input
                        id="test-login-identifier"
                        name="testIdentifier"
                        dir="ltr"
                        value={testIdentifier}
                        onChange={(event) => {
                          setTestIdentifier(
                            normalizeDigits(event.target.value),
                          );
                          setTestError("");
                        }}
                        required
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="none"
                        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        disabled={testPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="test-login-password"
                        className="block text-sm font-medium"
                      >
                        رمز دسترسی آزمایشی
                      </label>

                      <input
                        id="test-login-password"
                        name="testPassword"
                        dir="ltr"
                        type="password"
                        value={testPassword}
                        onChange={(event) => {
                          setTestPassword(event.target.value);
                          setTestError("");
                        }}
                        required
                        autoComplete="current-password"
                        aria-describedby={
                          testError ? "test-login-error" : undefined
                        }
                        aria-invalid={Boolean(testError)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        disabled={testPending}
                      />
                    </div>

                    {testError && (
                      <p
                        id="test-login-error"
                        role="alert"
                        className="text-sm leading-6 text-destructive"
                      >
                        {testError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={testPending}
                      loading={testPending}
                    >
                      {testPending ? "در حال ورود…" : "ورود به حساب آزمایشی"}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
