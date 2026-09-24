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
import {
  LOGIN_ROLE_CONFIG,
  getAuthErrorMessage,
} from "@/features/auth/config";
import {
  buildLoginIdentitySchema,
  otpCodeSchema,
} from "@/features/auth/schemas";
import RoleSelector from "./RoleSelector";
import IdentityForm from "./IdentityForm";
import OtpForm from "./OtpForm";

const HEADING_ID = "login-heading";

/**
 * Role-based login: role → identity (+ mobile) → OTP.
 * All authorization happens on the server; the selected role is only an input.
 *
 * @param {{ next?: string | null, isDevelopmentAuth?: boolean }} props
 */
export default function LoginCard({ next = null, isDevelopmentAuth = false }) {
  const router = useRouter();

  const [step, setStep] = useState("role"); // "role" | "identity" | "otp"
  const [role, setRole] = useState(null);
  const [values, setValues] = useState({ identifier: "", phone: "" });
  const [submitted, setSubmitted] = useState(null); // canonical values sent to the server
  const [fieldErrors, setFieldErrors] = useState({});
  const [focusRequest, setFocusRequest] = useState(0);
  const [formError, setFormError] = useState(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [done, setDone] = useState(false);

  const config = role ? LOGIN_ROLE_CONFIG[role] : null;

  function handleSelectRole(nextRole) {
    if (nextRole !== role) {
      setValues((prev) => ({ ...prev, identifier: "" }));
    }
    setRole(nextRole);
    setFieldErrors({});
    setFormError(null);
    setStep("identity");
  }

  function handleFieldChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: normalizeDigits(value) }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
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
      const result = await auth.requestLoginOtp({ role, ...parsed.data });

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
      const result = await auth.requestLoginOtp({ role, ...submitted });

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

  async function handleVerify() {
    if (pending || !role || !submitted) return;

    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? getAuthErrorMessage("WRONG_OTP"));
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
        setDone(true); // stay in the pending state while navigating
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

      // The identity itself was rejected: send the user back to fix it.
      if (result?.code === "INVALID_INPUT" || result?.code === "USER_NOT_FOUND") {
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
        <h1
          id={HEADING_ID}
          className="text-2xl font-semibold tracking-tight"
        >
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
                onBack={handleBackToRole}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
