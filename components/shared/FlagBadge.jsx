import { ArrowDown, ArrowUp, Check, TriangleAlert } from "lucide-react";
import StatusBadge from "./StatusBadge";

/**
 * Lab-result flag. Matches AGENTS.md §20: symbol + label together, color
 * never carries the meaning alone.
 * @param {{ flag: "normal"|"low"|"high"|"critical_low"|"critical_high" }} props
 */
export default function FlagBadge({ flag }) {
  switch (flag) {
    case "normal":
      return <StatusBadge variant="normal" icon={Check} label="عادی" />;
    case "low":
      return <StatusBadge variant="low" icon={ArrowDown} label="پایین" />;
    case "high":
      return <StatusBadge variant="high" icon={ArrowUp} label="بالا" />;
    case "critical_low":
      return (
        <StatusBadge variant="critical" icon={TriangleAlert} label="بحرانی (پایین)" />
      );
    case "critical_high":
      return (
        <StatusBadge variant="critical" icon={TriangleAlert} label="بحرانی (بالا)" />
      );
    default:
      return <StatusBadge variant="neutral" label="نامشخص" />;
  }
}
