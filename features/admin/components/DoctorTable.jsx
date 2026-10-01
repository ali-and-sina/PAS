import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toLocalMobile } from "@/lib/utils/validation";

/**
 * @param {{ doctors: Array<{
 *   id: string, full_name: string, phone: string,
 *   medical_license_number: string, specialty: string,
 *   is_verified: boolean, created_at_display: string,
 * }> }} props
 */
export default function DoctorTable({ doctors }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>نام</TableHead>
            <TableHead>شماره موبایل</TableHead>
            <TableHead>شماره نظام پزشکی</TableHead>
            <TableHead>تخصص</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>تاریخ ایجاد</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {doctors.map((doctor) => (
            <TableRow key={doctor.id}>
              <TableCell className="font-medium">{doctor.full_name}</TableCell>
              <TableCell dir="ltr" className="tabular-nums">
                {toLocalMobile(doctor.phone)}
              </TableCell>
              <TableCell dir="ltr" className="tabular-nums">
                {doctor.medical_license_number}
              </TableCell>
              <TableCell>{doctor.specialty}</TableCell>
              <TableCell>
                {doctor.is_verified ? (
                  <StatusBadge variant="normal" label="تأییدشده" />
                ) : (
                  <StatusBadge variant="low" label="تأییدنشده" />
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {doctor.created_at_display}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
