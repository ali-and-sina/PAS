import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientInterpretations } from "@/features/interpretations/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function PatientInterpretationsPage() {
  const sessionUser = await getSessionUser();
  const patientId = sessionUser?.id ?? sessionUser?.user?.id;

  if (!patientId) redirect("/login");

  const interpretations = await getPatientInterpretations(
    patientId,
  );

  return (
    <div>
      <PageHeader
        title="تفسیر پزشکان"
        description="تفسیرهایی که پزشک پس از بررسی نتایج برای شما قابل مشاهده کرده است."
      />

      {interpretations.length === 0 ? (
        <EmptyState
          title="هنوز تفسیری ثبت نشده است"
          description="پس از ثبت و انتشار تفسیر توسط پزشک، آن را در این بخش خواهید دید."
        />
      ) : (
        <div className="space-y-4">
          {interpretations.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-semibold">
                  {item.doctor_name}
                </h2>
                <time className="text-xs text-muted-foreground">
                  {formatDate(item.created_at)}
                </time>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
