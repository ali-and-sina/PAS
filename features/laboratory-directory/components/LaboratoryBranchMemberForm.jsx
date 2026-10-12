"use client";

import { useActionState } from "react";
import { UserRoundCog } from "lucide-react";

import { saveLaboratoryBranchMember } from "@/features/laboratory-directory/admin-actions";
import { Button } from "@/components/ui/button";

const initialState = { ok: false, message: "" };
export default function LaboratoryBranchMemberForm({ branchId, account, membership = null }) {
  const [state, formAction, pending] = useActionState(saveLaboratoryBranchMember, initialState);
  return <form action={formAction} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center">
    <input type="hidden" name="branch_id" value={branchId} /><input type="hidden" name="profile_id" value={account.id} />
    <div className="min-w-0"><p className="truncate text-sm font-medium">{account.full_name || "حساب آزمایشگاه"}</p><p className="mt-1 text-xs text-muted-foreground">مجوز: {account.license_number || "—"}{account.phone ? ` · ${account.phone}` : ""}</p></div>
    <select name="role_in_branch" defaultValue={membership?.role_in_branch || "member"} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label={`نقش ${account.full_name || "حساب آزمایشگاه"}`}><option value="manager">مدیر شعبه</option><option value="reception">پذیرش</option><option value="laboratory_staff">کارشناس آزمایشگاه</option><option value="member">عضو</option></select>
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 whitespace-nowrap text-xs"><input type="checkbox" name="is_active" defaultChecked={membership ? membership.is_active : true} className="size-4 accent-primary" />فعال</label><Button type="submit" size="sm" variant="outline" disabled={pending}><UserRoundCog aria-hidden="true" />{pending ? "ذخیره…" : "ثبت دسترسی"}</Button></div>
    {state.message && <p className={`text-xs sm:col-span-3 ${state.ok ? "text-status-normal" : "text-destructive"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
