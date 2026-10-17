"use client";

import { useTransition } from "react";
import { CheckCircle2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeDoctorVerification, verifyDoctor } from "@/features/admin/actions";

export default function DoctorVerificationActions({ doctorId, isVerified }) {
  const [pending, startTransition] = useTransition();

  function run(action) {
    startTransition(async () => {
      try {
        const result = await action(doctorId);
        if (!result?.ok) {
          toast.error(result?.message || "عملیات انجام نشد.");
          return;
        }
        toast.success(isVerified ? "تأیید پزشک لغو شد." : "پزشک تأیید شد.");
      } catch {
        toast.error("عملیات انجام نشد.");
      }
    });
  }

  return isVerified ? (
    <Button type="button" size="sm" variant="outline" disabled={pending} loading={pending} onClick={() => run(revokeDoctorVerification)}>
      <ShieldOff aria-hidden="true" />
      لغو تأیید
    </Button>
  ) : (
    <Button type="button" size="sm" disabled={pending} loading={pending} onClick={() => run(verifyDoctor)}>
      <CheckCircle2 aria-hidden="true" />
      تأیید پزشک
    </Button>
  );
}
