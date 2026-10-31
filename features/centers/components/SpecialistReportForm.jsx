"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCareAction, CareFeedback } from "@/components/care/ActionControls";
import { createCareUpload } from "@/features/care/actions";
import { createClient } from "@/lib/supabase/client";

export default function SpecialistReportForm({ request, current, config = null, onSaved }) {
  const [measurements, setMeasurements] = useState(() => ({...(current?.measurements || {})}));
  const [conclusion, setConclusion] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const { run, pending, feedback } = useCareAction();
  async function submit(event) {
    event.preventDefault(); setError("");
    const reportText = config ? config.fields.filter(f=>measurements[f.key]?.trim()).map(f=>f.label+": "+measurements[f.key].trim()).join("\n\n") : conclusion;
    if (reportText.length > 16000) return setError("متن گزارش طولانی است؛ مجموع گزارش را کوتاه‌تر کنید.");
    let path = null;
    if (file) {
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 20971520) return setError("پیوست باید تصویر یا پی‌دی‌اف و حداکثر ۲۰ مگابایت باشد.");
      setUploading(true);
      try {
        const upload = await createCareUpload({ kind: "medical-document", resourceId: request.id, mimeType: file.type, fileSize: file.size });
        if (!upload.ok) return setError(upload.message);
        const db = createClient();
        const { error: uploadError } = await db.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
        if (uploadError) return setError("پیوست بارگذاری نشد.");
        path = upload.path;
      } catch { return setError("بارگذاری پیوست انجام نشد."); }
      finally { setUploading(false); }
    }
    run("medical.finish", { id: request.id, conclusion: reportText, measurements: config ? measurements : {}, attachment_path: path, supersedes_id: current?.id || null }, () => { setConclusion(""); setFile(null); onSaved?.(); });
  }
  return <form onSubmit={submit} className="space-y-3 rounded-xl bg-muted/30 p-4"><h4 className="text-sm font-semibold">{current ? "ثبت اصلاحیهٔ گزارش" : "ثبت گزارش نهایی"}</h4>{config && <div className="grid gap-4 sm:grid-cols-2">{config.fields.map(f=><label key={f.key} className={"block space-y-2 text-sm "+(f.multiline?"sm:col-span-2":"")}><span>{f.label}</span>{f.multiline ? <Textarea value={measurements[f.key]||""} onChange={e=>setMeasurements(old=>({...old,[f.key]:e.target.value}))} rows={4} minLength={5} maxLength={4000} required={["findings","impression","assessment","outcome","procedure"].includes(f.key)} disabled={pending||uploading} /> : <Input value={measurements[f.key]||""} onChange={e=>setMeasurements(old=>({...old,[f.key]:e.target.value}))} maxLength={4000} disabled={pending||uploading} />}</label>)}</div>}{!config && <label className="block space-y-2 text-sm"><span>شرح و نتیجهٔ خدمت</span><Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} minLength={5} maxLength={16000} rows={5} required disabled={pending || uploading} /></label>}<div className="space-y-2 text-sm"><p>گزارش یا تصویر پیوست، اختیاری</p><label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 focus-within:ring-2 focus-within:ring-ring"><input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="انتخاب گزارش یا تصویر پیوست" disabled={pending || uploading} onChange={(e) => setFile(e.target.files?.[0] || null)} /><span className="shrink-0 font-medium text-primary">انتخاب پیوست</span><span className="min-w-0 truncate text-xs text-muted-foreground">{file?.name || "پیوستی انتخاب نشده است"}</span></label><p className="text-xs leading-6 text-muted-foreground">تصویر یا پی‌دی‌اف، حداکثر ۲۰ مگابایت</p></div><Button type="submit" disabled={pending || uploading} loading={pending || uploading}>{uploading ? "در حال بارگذاری..." : current ? "ثبت اصلاحیه" : "نهایی‌کردن گزارش"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<CareFeedback value={feedback} /></form>;
}
