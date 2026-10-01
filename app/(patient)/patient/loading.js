import PatientSpinner from "@/components/shared/PatientSppiner";
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PatientSpinner size={56} />
    </div>
  );
}
