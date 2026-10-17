import Link from "next/link";

import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function GuestResultLandingPage({ params }) {
  const { token } = await params;

  return (
    <>
      <style>{`
        @keyframes paFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes paButtonIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes paButtonPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
          }

          50% {
            box-shadow: 0 0 0 5px rgba(20, 184, 166, 0.045);
          }
        }

        .pa-intro {
          animation: paFadeUp 700ms ease-out both;
        }

        .pa-button {
          opacity: 0;
          animation:
            paButtonIn 750ms 950ms ease-out forwards,
            paButtonPulse 3.8s 1800ms ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .pa-intro,
          .pa-button {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      <main
        id="main-content"
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10"
      >
        {/* Very subtle background pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {/* Large soft line structure */}
          <svg
            className="absolute -right-24 -top-24 h-[420px] w-[420px] text-primary/[0.075]"
            viewBox="0 0 420 420"
            fill="none"
          >
            <path
              d="M420 40C215 40 40 215 40 420"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M420 72C233 72 72 233 72 420"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M420 104C251 104 104 251 104 420"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M420 136C269 136 136 269 136 420"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>

          {/* Bottom-left structure */}
          <svg
            className="absolute -bottom-28 -left-20 h-[360px] w-[360px] text-primary/[0.06]"
            viewBox="0 0 360 360"
            fill="none"
          >
            <path
              d="M0 320C176 320 320 176 320 0"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M0 286C157 286 286 157 286 0"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M0 252C138 252 252 138 252 0"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>

          {/* Small geometric detail */}
          <svg
            className="absolute right-[14%] top-[20%] h-14 w-14 text-primary/[0.09]"
            viewBox="0 0 56 56"
            fill="none"
          >
            <circle
              cx="28"
              cy="28"
              r="19"
              stroke="currentColor"
              strokeWidth="1"
            />
            <circle
              cx="28"
              cy="28"
              r="4"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>

          {/* Small line detail */}
          <svg
            className="absolute bottom-[22%] left-[14%] h-16 w-16 text-primary/[0.075]"
            viewBox="0 0 64 64"
            fill="none"
          >
            <path d="M8 32H56" stroke="currentColor" strokeWidth="1" />
            <path d="M32 8V56" stroke="currentColor" strokeWidth="1" />
            <circle
              cx="32"
              cy="32"
              r="8"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <section className="text-center">
            {/* Brand + intro */}
            <div className="pa-intro">
              <div className="mb-4 flex justify-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.045]">
                  <span className="text-base font-bold tracking-tight text-primary">
                    پاس
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground">
                پلتفرم ارزیابی سلامت
              </p>

              <div className="mx-auto mt-10 flex size-14 items-center justify-center rounded-full border border-primary/10 bg-background/90 shadow-sm">
                <CheckCircle2
                  className="size-7 text-primary"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
              </div>

              <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                نتیجه آزمایش شما آماده است.
              </h1>

              <div className="mx-auto mt-5 max-w-sm space-y-2 text-sm leading-7 text-muted-foreground">
                <p>نتیجه آزمایش شما اکنون در پاس آماده مشاهده است.</p>

                <p>
                  پاس کمک می‌کند نتایج آزمایش، سوابق سلامت و پیگیری‌های مربوط به
                  شما در یک فضای ساده و یکپارچه در دسترس باشند.
                </p>
              </div>
            </div>

            {/* Delayed CTA */}
            <div className="mt-9">
              <Button
                asChild
                size="lg"
                className="pa-button h-12 w-full rounded-2xl text-sm font-medium shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/patient/result/${token}/view`}>
                  <span>مشاهده نتیجه آزمایش</span>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            {/* Security note */}
            <div className="mx-auto mt-5 flex max-w-sm items-start justify-center gap-2 text-xs leading-6 text-muted-foreground/75">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-primary/75"
                aria-hidden="true"
              />

              <span>
                مشاهده این نتیجه بدون نیاز به ساخت حساب کاربری امکان‌پذیر است.
              </span>
            </div>

            <p className="mt-12 text-[11px] text-muted-foreground/45">
              پاس؛ ساده‌تر برای دسترسی به اطلاعات سلامت
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
