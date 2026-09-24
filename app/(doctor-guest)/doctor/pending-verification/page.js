import { ShieldAlert } from "lucide-react";

export const metadata = { title: "در انتظار تأیید" };

/**
 * Shown instead of the doctor app shell until is_verified becomes true.
 * Intentionally has no sidebar/nav — there is nothing to navigate to yet.
 */
export default function PendingVerificationPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center px-4"
    >
      <div className="max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <ShieldAlert
            className="size-12 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <h1 className="text-2xl font-semibold">در انتظار تأیید</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          حساب شما ثبت شده و در انتظار تأیید نظام پزشکی است. پس از تأیید،
          دسترسی به داشبورد پزشک فعال می‌شود.
        </p>
      </div>
    </main>
  );
}
