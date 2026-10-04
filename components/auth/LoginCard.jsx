"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
        loginContext: fixedRole === "admin" ? "admin" : "public",
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

      setTestError("شناسه یا رمز ورود تست نادرست است.");
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
      title: "ورود به پزشک‌یار",
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

  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader className="space-y-2 text-center">
        <h1 id={HEADING_ID} className="text-2xl font-semibold tracking-tight">
          {header.title}
        </h1>

        <CardDescription className="leading-relaxed">
          {header.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
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

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              با ورود، شرایط استفاده و سیاست حریم خصوصی را می‌پذیرید.
            </p>

            {isDevelopmentAuth && (
              <div className="mt-5 border-t pt-4">
                {!showTestLogin ? (
                  <button
                    type="button"
                    className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => setShowTestLogin(true)}
                  >
                    ورود تست
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
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
                            className="rounded-md border px-2 py-2 text-xs hover:bg-accent"
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
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
                        placeholder="رمز عبور تست"
                        autoComplete="off"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={testPending}
                      />

                      {testError && (
                        <p className="text-xs text-destructive">{testError}</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          onClick={handleTestLogin}
                          disabled={testPending}
                        >
                          {testPending ? "در حال ورود..." : "ورود تست"}
                        </button>

                        <button
                          type="button"
                          className="h-10 rounded-md border px-3 text-sm hover:bg-accent"
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
