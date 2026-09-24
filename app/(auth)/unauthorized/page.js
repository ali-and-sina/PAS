import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "دسترسی غیرمجاز",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Lock
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">دسترسی امکان‌پذیر نیست</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            شما مجوز مشاهده این بخش را ندارید.
          </p>
        </div>

        <div className="flex justify-center">
          <Button asChild>
            <Link href="/">بازگشت به داشبورد</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
