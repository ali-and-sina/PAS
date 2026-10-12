import Link from "next/link";
import { ArrowRight, NotebookPen } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientInterpretations } from "@/features/patient/queries";
import Pagination from "@/components/shared/Pagination";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export default async function PatientInterpretationsPage({ searchParams }) {
  const params = await searchParams;
  const result = await getPatientInterpretations({ page: params?.page ?? 1 });
  const interpretations = result.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="توضیحات پزشک"
        description="توضیحاتی که پزشک برای نتایج شما ثبت کرده و اجازه نمایش به بیمار دارند."
      />

      {interpretations.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={NotebookPen}
              title="هنوز توضیح قابل نمایش ثبت نشده است"
              description="وقتی پزشک توضیحی را برای بیمار قابل مشاهده کند، در اینجا ظاهر می‌شود."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interpretations.map((item) => {
            const doctor = item.doctor_profiles;
            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {doctor?.full_name ? `دکتر ${doctor.full_name}` : "پزشک"}
                      </p>
                      {doctor?.specialty && (
                        <p className="mt-1 text-xs text-muted-foreground">{doctor.specialty}</p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground">{formatDate(item.created_at)}</time>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-8 text-muted-foreground">
                    {item.interpretation}
                  </p>

                  {item.diagnostic_report_id && (
                    <Link
                      href={`/patient/results/${item.diagnostic_report_id}`}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      مشاهده نتیجه مرتبط
                      <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination pathname="/patient/interpretations" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
