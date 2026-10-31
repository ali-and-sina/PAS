"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { createLabOrder } from "@/features/lab-orders/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

function itemLabel(item) {
  return item.label || "آزمایش";
}

export default function LabOrderForm({ patients, testPanels, testDefinitions = [], defaultPatientId = "", redirectTo = null }) {
  const [state, formAction, pending] = useActionState(createLabOrder, initialState);
  const router = useRouter();
  const [kind, setKind] = useState("panel");
  const [selectedId, setSelectedId] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  const choices = useMemo(() => kind === "panel" ? testPanels : testDefinitions, [kind, testPanels, testDefinitions]);
  useEffect(() => {
    if (state.ok && state.requestId) {
      router.push(redirectTo || `/doctor/lab-orders/${state.requestId}`);
    }
  }, [state.ok, state.requestId, redirectTo, router]);

  const normalizedChoices = useMemo(() => choices.map((row) => ({
    id: row.id,
    label: row.name_fa || row.name || row.internal_code || "آزمایش",
    category: row.category,
  })), [choices]);

  function addItem() {
    const choice = normalizedChoices.find((row) => row.id === selectedId);
    if (!choice) return;
    const key = `${kind}:${choice.id}`;
    if (selectedItems.some((item) => item.key === key)) return;
    setSelectedItems((items) => [...items, {
      key,
      label: choice.label,
      test_panel_id: kind === "panel" ? choice.id : null,
      test_definition_id: kind === "test" ? choice.id : null,
    }]);
    setSelectedId("");
  }

  return (
    <form action={formAction} className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="patient_id">بیمار</Label>
        <select id="patient_id" name="patient_id" defaultValue={defaultPatientId} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">انتخاب بیمار</option>
          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name || "بدون نام"}</option>)}
        </select>
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">آزمایش‌های درخواستی</legend>
        <p className="text-sm leading-6 text-muted-foreground">آزمایش‌ها را انتخاب کنید؛ انتخاب شعبهٔ مقصد در اختیار بیمار خواهد بود.</p>
        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="item_kind">نوع مورد</Label>
            <select id="item_kind" value={kind} onChange={(event) => { setKind(event.target.value); setSelectedId(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="panel">پنل آزمایش</option>
              <option value="test">آزمایش تکی</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="selected_item">انتخاب مورد</Label>
            <select id="selected_item" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">انتخاب کنید</option>
              {normalizedChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}{choice.category ? ` — ${choice.category}` : ""}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={addItem} disabled={!selectedId || selectedItems.some((item) => item.key === `${kind}:${selectedId}`)}><Plus aria-hidden="true" />افزودن</Button>
        </div>
        {!normalizedChoices.length && <p className="text-sm text-muted-foreground">برای این نوع مورد، داده‌ای در فهرست فعال وجود ندارد.</p>}
        {selectedItems.length ? (
          <ul className="space-y-2">
            {selectedItems.map((item) => <li key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden="true" />{item.label}<span className="text-xs text-muted-foreground">{item.test_panel_id ? "پنل" : "تکی"}</span></span><Button type="button" variant="ghost" size="icon" aria-label={`حذف ${item.label}`} onClick={() => setSelectedItems((items) => items.filter((entry) => entry.key !== item.key))}><X aria-hidden="true" /></Button></li>)}
          </ul>
        ) : <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">هنوز موردی انتخاب نشده است.</p>}
        <input type="hidden" name="items_json" value={JSON.stringify(selectedItems.map(({ test_panel_id, test_definition_id }) => ({ test_panel_id, test_definition_id })))} />
      </fieldset>

      <div className="space-y-2"><Label htmlFor="clinical_note">یادداشت بالینی برای آزمایشگاه</Label><Textarea id="clinical_note" name="clinical_note" rows={4} maxLength={2000} placeholder="در صورت نیاز، توضیح بالینی مرتبط را بنویسید." /></div>
      {state.message && <p className={`text-sm ${state.ok ? "text-status-normal" : "text-destructive"}`} role={state.ok ? "status" : "alert"}>{state.message}{state.ok && state.requestId ? <> <Link className="font-medium underline" href="/doctor/medical-services">مشاهدهٔ مراکز درمانی</Link></> : null}</p>}
      <Button type="submit" disabled={pending || selectedItems.length === 0} loading={pending}>{pending ? "در حال ثبت…" : "ثبت درخواست آزمایش"}</Button>
    </form>
  );
}
