import { Mail, ShieldCheck, UserRound } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatientProfile } from "@/features/patient/queries";
import PatientProfileForm from "@/features/patient/components/PatientProfileForm";
import VoiceRecordingConsentCard from "@/features/physician-care/components/VoiceRecordingConsentCard";
import { getPhysicianVoiceRecordingConsentStatus } from "@/features/physician-care/consent-queries";

export const dynamic = "force-dynamic";

export default async function PatientProfilePage() {
  const [data, voiceConsent] = await Promise.all([
    getPatientProfile(),
    getPhysicianVoiceRecordingConsentStatus(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="پروفایل من"
        description="اطلاعات شخصی و راه‌های ارتباطی پرونده خود را مدیریت کنید."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <UserRound className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">نقش</p>
              <p className="mt-1 font-medium">بیمار</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Mail className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">تلفن</p>
              <p className="mt-1 font-medium" dir="ltr">{data.profile.phone ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">امنیت</p>
              <p className="mt-1 font-medium">هویت از نشست حساب تعیین می‌شود</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PatientProfileForm
        initialProfile={data.profile}
        initialPatientProfile={data.patient_profile}
      />

      <VoiceRecordingConsentCard
        initialGranted={voiceConsent.granted}
        grantedAt={voiceConsent.grantedAt}
      />

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات غیرقابل ویرایش در این بخش</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info label="شناسه حساب" value={data.profile.id} dir="ltr" />
          <Info label="شناسه ملی" value={data.profile.national_id} dir="ltr" />
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, dir }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium" dir={dir}>
        {value ?? "ثبت نشده"}
      </p>
    </div>
  );
}
