import { Pill } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientPrescriptions } from "@/features/prescriptions/queries";
import Pagination from "@/components/shared/Pagination";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function prescriptionStatus(status) {
  const map = {
    active: { label: "فعال", variant: "normal" },
    completed: { label: "تکمیل‌شده", variant: "neutral" },
    cancelled: { label: "لغوشده", variant: "neutral" },
  };
  return map[status] ?? { label: status ?? "نامشخص", variant: "neutral" };
}

export default async function PatientPrescriptionsPage({ searchParams }) {
  const params = await searchParams;
  const result = await getPatientPrescriptions({ page: params?.page ?? 1 });
  const prescriptions = result.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="نسخه‌ها"
        description="نسخه‌هایی که پزشکان برای شما ثبت کرده‌اند."
      />

      {prescriptions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Pill}
              title="نسخه‌ای ثبت نشده است"
              description="نسخه‌های ثبت‌شده در این بخش نگهداری می‌شوند."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((prescription) => {
            const doctor = prescription.doctor_profiles;
            const status = prescriptionStatus(prescription.status);

            return (
              <Card key={prescription.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {doctor?.full_name ? `دکتر ${doctor.full_name}` : "پزشک"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        تاریخ نسخه: {formatDate(prescription.issued_at ?? prescription.created_at)}
                      </p>
                    </div>
                    <StatusBadge label={status.label} variant={status.variant} />
                  </div>

                  <div className="divide-y">
                    {(prescription.prescription_items ?? []).map((item) => (
                      <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                        <p className="font-medium">{item.medication_name}</p>
                        <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <span>دوز: {item.dosage || "—"}</span>
                          <span>مصرف: {item.frequency || "—"}</span>
                          <span>مدت: {item.duration || "—"}</span>
                        </div>
                        {item.instructions && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            توضیحات: {item.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination pathname="/patient/prescriptions" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
