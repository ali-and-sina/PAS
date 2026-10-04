import {
  Beaker,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Microscope,
  NotebookPen,
  Pill,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import { ROLES } from "@/lib/auth/roles";

export const NAVIGATION_BY_ROLE = {
  [ROLES.PATIENT]: [
    { href: "/patient/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/patient/results", label: "آزمایش‌ها", icon: FileText },
    { href: "/patient/trends", label: "روندها", icon: LineChart },
    { href: "/patient/interpretations", label: "تفسیر پزشکان", icon: NotebookPen },
    { href: "/patient/prescriptions", label: "نسخه‌ها", icon: Pill },
    { href: "/patient/doctor-requests", label: "درخواست‌های پزشکان", icon: UserCheck },
    { href: "/patient/health-record", label: "سوابق سلامت", icon: ClipboardList },
  ],

  [ROLES.DOCTOR]: [
    { href: "/doctor/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/doctor/patients", label: "بیماران", icon: Users },
    { href: "/doctor/lab-orders", label: "سفارش آزمایش", icon: Beaker },
    { href: "/doctor/interpretations", label: "تفسیرها", icon: NotebookPen },
    { href: "/doctor/prescriptions", label: "نسخه‌ها", icon: Pill },
  ],

  [ROLES.ADMIN]: [
    { href: "/admin", label: "مدیریت", icon: ShieldCheck },
    { href: "/admin/users", label: "کاربران", icon: Users },
    { href: "/admin/doctors", label: "پزشکان", icon: Stethoscope },
    { href: "/admin/laboratories", label: "آزمایشگاه‌ها", icon: Building2 },
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
  [ROLES.ADMIN]: { label: "مدیر", icon: ShieldCheck },
};
