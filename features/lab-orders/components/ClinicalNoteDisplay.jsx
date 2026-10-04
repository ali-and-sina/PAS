export default function ClinicalNoteDisplay({ note }) {
  return <p className="whitespace-pre-wrap text-sm leading-7">{note || "یادداشت بالینی ثبت نشده است."}</p>;
}
