import LabResultRow from "./LabResultRow";

export default function LabResultTable({ observations }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40"><th className="p-3 text-start">آزمایش</th><th className="p-3 text-start">نتیجه</th><th className="p-3 text-start">واحد</th><th className="p-3 text-start">محدوده مرجع</th><th className="p-3 text-start">وضعیت</th></tr></thead>
          <tbody>{observations.map((observation) => <LabResultRow key={observation.id} observation={observation} />)}</tbody>
        </table>
      </div>
    </div>
  );
}
