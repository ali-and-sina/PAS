import { redirect } from "next/navigation";
import { FlaskConical, Pill, Stethoscope } from "lucide-react";

import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = {
  title: "پرونده سلامت",
};

export default async function HealthRecordPage() {
  const user = await getSessionUser();

  if (!user || user.role !== ROLES.PATIENT) {
    redirect(LOGIN_PATH);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="پرونده سلامت"
        description="نتایج آزمایش‌ها، تفسیرهای پزشک و نسخه‌های شما در یک نگاه."
      />

      <Tabs defaultValue="results" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="results">نتایج آزمایش</TabsTrigger>
          <TabsTrigger value="interpretations">تفسیرها</TabsTrigger>
          <TabsTrigger value="prescriptions">نسخه‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-6">
          {/*
            اینجا لیست نتایج آزمایش بیمار قرار می‌گیرد.
            کامپوننت مورد انتظار: <LabResultsList patientId={user.id} />
          */}
          <EmptyState
            title="هنوز نتیجه‌ای ثبت نشده است"
            description="پس از انجام آزمایش و ثبت نتیجه توسط آزمایشگاه، نتایج در این بخش نمایش داده می‌شوند."
            icon={FlaskConical}
          />
        </TabsContent>

        <TabsContent value="interpretations" className="mt-6">
          {/*
            اینجا لیست تفسیرهای پزشک قرار می‌گیرد.
            کامپوننت مورد انتظار: <InterpretationsList patientId={user.id} />
          */}
          <EmptyState
            title="هنوز تفسیری ثبت نشده است"
            description="تفسیرهای پزشک پس از بررسی نتایج، در این بخش نمایش داده می‌شوند."
            icon={Stethoscope}
          />
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6">
          {/*
            اینجا لیست نسخه‌ها قرار می‌گیرد.
            کامپوننت مورد انتظار: <PrescriptionsList patientId={user.id} />
          */}
          <EmptyState
            title="هنوز نسخه‌ای صادر نشده است"
            description="نسخه‌های صادرشده توسط پزشک، در این بخش نمایش داده می‌شوند."
            icon={Pill}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
