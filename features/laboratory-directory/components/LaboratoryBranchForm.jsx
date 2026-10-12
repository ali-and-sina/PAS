"use client";

import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";

import { saveLaboratoryBranch } from "@/features/laboratory-directory/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { ok: false, message: "" };
export default function LaboratoryBranchForm({ organizations, branch = null, compact = false }) {
  const [state, formAction, pending] = useActionState(saveLaboratoryBranch, initialState);
  return <form action={formAction} className={`space-y-4 ${compact ? "rounded-xl border p-4" : "rounded-xl border bg-card p-5 sm:p-6"}`}>
    <input type="hidden" name="branch_id" value={branch?.branch_id || branch?.id || ""} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`org-${branch?.branch_id || "new"}`}>سازمان آزمایشگاهی</Label><select id={`org-${branch?.branch_id || "new"}`} name="organization_id" required defaultValue={branch?.organization_id || ""} disabled={Boolean(branch)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70">{!branch && <option value="">انتخاب سازمان</option>}{organizations.map((organization) => <option key={organization.organization_id} value={organization.organization_id}>{organization.organization_name}</option>)}</select>{branch && <input type="hidden" name="organization_id" value={branch.organization_id} />}</div>
      <div className="space-y-1.5"><Label htmlFor={`name-${branch?.branch_id || "new"}`}>نام شعبه</Label><Input id={`name-${branch?.branch_id || "new"}`} name="display_name" required minLength={2} maxLength={160} defaultValue={branch?.display_name || ""} placeholder="مثلاً شعبه مرکزی" /></div>
      <div className="space-y-1.5"><Label htmlFor={`city-${branch?.branch_id || "new"}`}>شهر</Label><Input id={`city-${branch?.branch_id || "new"}`} name="city" maxLength={120} defaultValue={branch?.city || ""} placeholder="نام شهر" /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`address-${branch?.branch_id || "new"}`}>نشانی</Label><Input id={`address-${branch?.branch_id || "new"}`} name="address" maxLength={500} defaultValue={branch?.address || ""} placeholder="نشانی کامل شعبه" /></div>
      <div className="space-y-1.5"><Label htmlFor={`lat-${branch?.branch_id || "new"}`}>عرض جغرافیایی (اختیاری)</Label><Input id={`lat-${branch?.branch_id || "new"}`} type="number" step="any" name="latitude" min="-90" max="90" defaultValue={branch?.latitude ?? ""} dir="ltr" /></div>
      <div className="space-y-1.5"><Label htmlFor={`lon-${branch?.branch_id || "new"}`}>طول جغرافیایی (اختیاری)</Label><Input id={`lon-${branch?.branch_id || "new"}`} type="number" step="any" name="longitude" min="-180" max="180" defaultValue={branch?.longitude ?? ""} dir="ltr" /></div>
    </div>
    <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={branch ? branch.is_active : true} className="size-4 accent-primary" />شعبه فعال باشد</label><label className="flex items-center gap-2"><input type="checkbox" name="supports_home_collection" defaultChecked={Boolean(branch?.supports_home_collection)} className="size-4 accent-primary" />نمونه‌گیری در منزل ارائه می‌دهد</label></div>
    {state.message && <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-status-normal" : "text-destructive"}`}>{state.ok && <CheckCircle2 className="ml-1 inline size-4" aria-hidden="true" />}{state.message}</p>}
    <Button type="submit" size={compact ? "sm" : "default"} disabled={pending || organizations.length === 0}><Save aria-hidden="true" />{pending ? "در حال ذخیره…" : branch ? "ذخیره تغییرات شعبه" : "ایجاد شعبه"}</Button>
  </form>;
}
