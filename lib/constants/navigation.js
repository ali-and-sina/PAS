import {
  Beaker,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Microscope,
  NotebookPen,
  Pill,
  Stethoscope,
  Users,
} from "lucide-react";
import { ROLES } from "@/lib/auth/roles";

/**
 * Role-based primary navigation. Keep this short — the sidebar is meant to
 * stay scannable in one glance (see AGENTS.md §6, "Navigation را بیش از حد
 * شلوغ نکن").
 */
export const NAVIGATION_BY_ROLE = {
  [ROLES.PATIENT]: [
    { href: "/patient/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/patient/results", label: "آزمایش‌ها", icon: FileText },
    { href: "/patient/trends", label: "روندها", icon: LineChart },
    { href: "/patient/interpretations", label: "تفسیر پزشکان", icon: NotebookPen },
    { href: "/patient/prescriptions", label: "نسخه‌ها", icon: Pill },
    { href: "/patient/health-record", label: "سوابق سلامت", icon: ClipboardList },
  ],
  [ROLES.DOCTOR]: [
    { href: "/doctor/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/doctor/patients", label: "بیماران", icon: Users },
    { href: "/doctor/lab-orders", label: "سفارش آزمایش", icon: Beaker },
    { href: "/doctor/interpretations", label: "تفسیرها", icon: NotebookPen },
    { href: "/doctor/prescriptions", label: "نسخه‌ها", icon: Pill },
  ],
  [ROLES.LABORATORY]: [
    { href: "/lab/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/lab/orders", label: "صف سفارش‌ها", icon: ListChecks },
    { href: "/lab/results", label: "نتایج ثبت‌شده", icon: Microscope },
  ],
};

export const NOTIFICATIONS_HREF_BY_ROLE = {
  [ROLES.PATIENT]: "/patient/notifications",
  [ROLES.DOCTOR]: "/doctor/notifications",
  [ROLES.LABORATORY]: "/lab/notifications",
};

export const ROLE_BRAND = {
  [ROLES.PATIENT]: { label: "بیمار", icon: Stethoscope },
  [ROLES.DOCTOR]: { label: "پزشک", icon: Stethoscope },
  [ROLES.LABORATORY]: { label: "آزمایشگاه", icon: Microscope },
};
