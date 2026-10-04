import DoctorRequestCard from "./DoctorRequestCard";

export default function DoctorRequestList({
  requests,
  acceptAction,
  rejectAction,
}) {
  if (!requests?.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-base font-semibold text-slate-800">
          درخواستی ندارید
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          هر زمان پزشکی درخواست برقراری ارتباط با پرونده شما را ارسال کند،
          درخواست او در این بخش نمایش داده می‌شود.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <DoctorRequestCard
          key={request.id}
          request={request}
          acceptAction={acceptAction}
          rejectAction={rejectAction}
        />
      ))}
    </div>
  );
}
