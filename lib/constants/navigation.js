import {
  Beaker,
  Building2,
  Bell,
  ClipboardList,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  Microscope,
  NotebookPen,
  Home,
  ScanLine,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { ROLES } from "@/lib/auth/roles";

/**
 * Keep role navigation short and expressed in natural Persian.
 * Detailed actions live inside their corresponding pages instead of adding
 * every workflow step to the sidebar.
 */
export const NAVIGATION_BY_ROLE = {
  [ROLES.PATIENT]: [
    { href: "/patient/dashboard", label: "خانه", icon: LayoutDashboard },
    { href: "/patient/health-record", label: "پرونده سلامت", icon: ClipboardList },
    { href: "/patient/results", label: "نتایج آزمایش", icon: FileText },
    { href: "/patient/lab-orders", label: "درخواست‌های آزمایش", icon: Beaker },
    { href: "/patient/follow-ups", label: "پیگیری‌ها", icon: ListChecks },
    { href: "/patient/profile", label: "پروفایل", icon: Users },
  ],
  [ROLES.DOCTOR]: [
    { href: "/doctor/dashboard", label: "خانه پزشک", icon: LayoutDashboard },
    { href: "/doctor/patients", label: "بیماران", icon: Users },
    { href: "/doctor/lab-orders", label: "درخواست‌های آزمایش", icon: Beaker },
    { href: "/doctor/interpretations", label: "بررسی نتایج", icon: NotebookPen },
    { href: "/doctor/follow-ups", label: "پیگیری بیماران", icon: ListChecks },
    { href: "/doctor/notes", label: "یادداشت‌های پزشک", icon: FileText },
    { href: "/doctor/prescriptions", label: "نسخه‌ها", icon: Pill },
    { href: "/doctor/notifications", label: "اعلان‌ها", icon: Bell },
  ],
  [ROLES.ADMIN]: [
    { href: "/admin", label: "مدیریت", icon: ShieldCheck },
    { href: "/admin/users", label: "کاربران", icon: Users },
    { href: "/admin/doctors", label: "پزشکان", icon: Stethoscope },
    { href: "/admin/laboratories", label: "آزمایشگاه‌ها", icon: Building2 },
    { href: "/admin/laboratories/branches", label: "مدیریت شعب", icon: Building2 },
  ],
  [ROLES.LABORATORY]: [
    { href: "/lab/dashboard", label: "خانه آزمایشگاه", icon: LayoutDashboard },
    { href: "/lab/dispatches", label: "درخواست‌های ارجاع‌شده", icon: ClipboardCheck },
    { href: "/lab/home-collection", label: "نمونه‌گیری در منزل", icon: Home },
    { href: "/lab/orders", label: "صف پذیرش", icon: ListChecks },
    { href: "/lab/intake/scan", label: "پذیرش با کد QR", icon: ScanLine },
    { href: "/lab/results", label: "نتایج آزمایش", icon: Microscope },
    { href: "/lab/notifications", label: "اعلان‌ها", icon: Bell },
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
