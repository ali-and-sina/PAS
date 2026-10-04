import { redirect } from "next/navigation";
import { Pill } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientPrescriptions } from "@/features/prescriptions/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusLabel(status) {
  if (status === "active") return "فعال";
  if (status === "completed") return "تکمیل‌شده";
  if (status === "cancelled") return "لغوشده";
  return status || "نامشخص";
}

export default async function PatientPrescriptionsPage() {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const prescriptions = await getPatientPrescriptions(
    patientId,
  );

  return (
    <div>
      <PageHeader
        title="نسخه‌های من"
        description="نسخه‌هایی که پزشکان برای شما ثبت کرده‌اند."
      />

      {prescriptions.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="هنوز نسخه‌ای ثبت نشده است"
          description="هر نسخه‌ای که پزشک برای شما صادر کند، در این بخش نمایش داده می‌شود."
        />
      ) : (
        <div className="space-y-4">
          {prescriptions.map((prescription) => (
            <article
              key={prescription.id}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">
                    {prescription.doctor_name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    تاریخ نسخه: {formatDate(prescription.issued_at)}
                  </p>
                </div>

                <span className="text-xs text-muted-foreground">
                  {statusLabel(prescription.status)}
                </span>
              </div>

              <div className="mt-4 divide-y">
                {(prescription.items || []).map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="font-medium">
                      {item.medication_name}
                    </h3>

                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <span>دوز: {item.dosage}</span>
                      <span>مصرف: {item.frequency}</span>
                      <span>مدت: {item.duration || "—"}</span>
                    </div>

                    {item.instructions ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.instructions}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
