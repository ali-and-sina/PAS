import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "صفحه یافت نشد",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <SearchX
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">صفحه یافت نشد</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            صفحه‌ای که به دنبال آن هستید وجود ندارد یا حذف شده است.
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
