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
 * @param {{ laboratories: Array<{
 *   id: string, organization_name: string, phone: string,
 *   license_number: string, organization_type: string,
 *   created_at_display: string,
 * }> }} props
 */
export default function LaboratoryTable({ laboratories }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>نام آزمایشگاه</TableHead>
            <TableHead>شماره مجوز</TableHead>
            <TableHead>نوع سازمان</TableHead>
            <TableHead>شماره تماس</TableHead>
            <TableHead>تاریخ ایجاد</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {laboratories.map((lab) => (
            <TableRow key={lab.id}>
              <TableCell className="font-medium">
                {lab.organization_name}
              </TableCell>
              <TableCell dir="ltr" className="tabular-nums">
                {lab.license_number}
              </TableCell>
              <TableCell>{lab.organization_type}</TableCell>
              <TableCell dir="ltr" className="tabular-nums">
                {toLocalMobile(lab.phone)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {lab.created_at_display}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
