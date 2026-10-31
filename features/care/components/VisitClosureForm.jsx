"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCareAction, CareFeedback } from "@/components/care/ActionControls";
export default function VisitClosureForm({ visitId }) {
  const [summary, setSummary] = useState("");
  const { run, pending, feedback } = useCareAction();
  return <form className="space-y-3 rounded-xl border bg-muted/30 p-4" onSubmit={(e) => { e.preventDefault(); run("visit.close", { visit_id: visitId, summary }); }}>
    <label className="block space-y-2 text-sm font-medium"><span>خلاصهٔ ویزیت برای بیمار</span><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} minLength={10} maxLength={12000} rows={4} required disabled={pending} placeholder="جمع‌بندی و توصیه‌های نهایی ویزیت را بنویسید." /></label>
    <p className="text-xs leading-6 text-muted-foreground">با ثبت خلاصه، ویزیت مختومه می‌شود و این متن در پروندهٔ بیمار قرار می‌گیرد.</p>
    <Button type="submit" disabled={pending || summary.trim().length < 10} loading={pending}>ثبت خلاصه و ختم ویزیت</Button>
    <CareFeedback value={feedback} />
  </form>;
}
