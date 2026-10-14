import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PatientActionBar({ patientId }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm">
        <Link href={`/doctor/lab-orders/new?patient=${patientId}`}>درخواست آزمایش</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/doctor/prescriptions?patient=${patientId}`}>نسخه جدید</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/doctor/interpretations?patient=${patientId}`}>تفسیرها</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="#voice-note">یادداشت صوتی ویزیت</Link>
      </Button>
    </div>
  );
}
