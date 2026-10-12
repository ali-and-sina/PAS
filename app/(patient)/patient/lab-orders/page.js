import { ClipboardList } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import PatientLabRequestCard from "@/features/lab-dispatch/components/PatientLabRequestCard";
import { getPatientLabRequests } from "@/features/lab-order-requests/queries";
import { searchLaboratoryBranches } from "@/features/laboratory-directory/queries";
import Pagination from "@/components/shared/Pagination";

export const metadata = { title: "درخواست‌های آزمایش من" };
export const dynamic = "force-dynamic";

export default async function PatientLabOrdersPage({ searchParams }) {
  const params = await searchParams;
  const [requestResult, branches] = await Promise.all([
    getPatientLabRequests({ page: params?.page ?? 1 }),
    searchLaboratoryBranches({ limit: 50 }),
  ]);
  const requests = requestResult.items;

  return <div className="space-y-5">
    <PageHeader title="درخواست‌های آزمایش من" description="درخواست ثبت‌شده توسط پزشک را بررسی کنید، شعبهٔ آزمایشگاه را انتخاب کنید و در صورت نیاز نمونه‌گیری در منزل بخواهید." />
    {requests.length ? <div className="grid gap-4">{requests.map((request) => <PatientLabRequestCard key={request.id} request={request} branches={branches} />)}</div> : <EmptyState icon={ClipboardList} title="هنوز درخواست آزمایشی ندارید" description="پس از ثبت درخواست توسط پزشک، موارد در این صفحه نمایش داده می‌شود." />}
    <Pagination pathname="/patient/lab-orders" page={requestResult.pagination.page} pageSize={requestResult.pagination.pageSize} totalCount={requestResult.pagination.totalCount} totalPages={requestResult.pagination.totalPages} />
  </div>;
}
