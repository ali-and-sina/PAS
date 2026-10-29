import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function PDFUploadField({ name = "pdf" }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed bg-card p-4 sm:p-5">
      <Label htmlFor={name}>فایل گزارش (اختیاری)</Label>
      <Input id={name} name={name} type="file" accept="application/pdf" aria-describedby={`${name}-hint`} className="file:me-3 file:rounded-lg file:bg-muted file:px-3 file:py-1" />
      <p id={`${name}-hint`} className="text-xs leading-6 text-muted-foreground">فقط PDF، حداکثر ۱۰ مگابایت. این فایل پیوست گزارش است؛ نتایج را در ردیف‌های بالا ثبت کنید.</p>
    </div>
  );
}
