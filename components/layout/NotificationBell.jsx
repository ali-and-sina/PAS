import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Static bell for now — the unread dot lights up once
 * NotificationPollingProvider (queued later) supplies a real count.
 * @param {{ href: string }} props
 */
export default function NotificationBell({ href }) {
  return (
    <Button variant="ghost" size="icon" asChild aria-label="اعلان‌ها">
      <Link href={href}>
        <Bell className="size-5" aria-hidden="true" />
      </Link>
    </Button>
  );
}
