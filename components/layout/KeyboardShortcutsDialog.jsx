"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["Ctrl/⌘", "K"], label: "باز کردن جستجوی صفحه‌ها" },
  { keys: ["?"], label: "باز کردن همین راهنما" },
  { keys: ["↑", "↓"], label: "حرکت بین نتایج جستجو" },
  { keys: ["Enter"], label: "باز کردن نتیجه انتخاب‌شده" },
  { keys: ["Esc"], label: "بستن پنجره یا جستجو" },
];

export default function KeyboardShortcutsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pe-8 text-start">
          <DialogTitle>راهنمای میانبرهای صفحه‌کلید</DialogTitle>
          <DialogDescription>برای دسترسی سریع‌تر به بخش‌های فضای کاری.</DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-xl border px-3">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="text-sm">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1" dir="ltr">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="min-w-7 rounded-md border bg-muted px-2 py-1 text-center font-sans text-xs text-muted-foreground">{key}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs leading-6 text-muted-foreground">میانبرها هنگام نوشتن در ورودی‌ها و فیلدهای متنی غیرفعال‌اند تا با تایپ شما تداخل نداشته باشند.</p>
      </DialogContent>
    </Dialog>
  );
}
