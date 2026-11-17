import DoctorRequestCard from "./DoctorRequestCard";

export default function DoctorRequestList({
  requests,
  acceptAction,
  rejectAction,
}) {
  if (!requests?.length) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-base font-semibold text-card-foreground">
          درخواستی ندارید
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
