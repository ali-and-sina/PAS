import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function PDFUploadField({ name = "pdf" }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>فایل گزارش (اختیاری)</Label>
      <Input id={name} name={name} type="file" accept="application/pdf" />
      <p className="text-xs text-muted-foreground">این فایل فقط برای پیوست است و منبع اصلی داده‌های ساختاریافته نیست.</p>
    </div>
  );
}
