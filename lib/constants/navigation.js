import { CENTER_TYPES, centerBase } from "@/lib/centers/config";
import {
  CalendarDays,
  MessageCircle,
  Truck,
  Scan,
  Settings,
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
    { href: "/patient/consultations", label: "ویزیت آنلاین", icon: MessageCircle },
    { href: "/patient/medical-services", label: "مراکز درمانی", icon: Building2 },
    { href: "/patient/prescriptions", label: "نسخه‌ها و داروها", icon: Pill },
    { href: "/patient/pharmacy", label: "تهیه و ارسال دارو", icon: Truck },
    { href: "/patient/doctor-requests", label: "درخواست‌های پزشکان", icon: ClipboardCheck },
    { href: "/patient/follow-ups", label: "پیگیری‌ها", icon: ListChecks },
  ],
  [ROLES.DOCTOR]: [
    { href: "/doctor/dashboard", label: "خانه پزشک", icon: LayoutDashboard },
    { href: "/doctor/consultations", label: "ویزیت آنلاین", icon: MessageCircle },
    { href: "/doctor/calendar", label: "تقویم بیماران", icon: CalendarDays },
    { href: "/doctor/medical-services", label: "مراکز درمانی", icon: Building2 },
    { href: "/doctor/patients", label: "بیماران", icon: Users },
    { href: "/doctor/interpretations", label: "بررسی نتایج", icon: NotebookPen },
    { href: "/doctor/follow-ups", label: "پیگیری بیماران", icon: ListChecks },
    { href: "/doctor/notes", label: "یادداشت‌های پزشک", icon: FileText },
    { href: "/doctor/prescriptions", label: "نسخه‌ها", icon: Pill },
    { href: "/doctor/notifications", label: "اعلان‌ها", icon: Bell },
  ],
  [ROLES.ADMIN]: [
    { href: "/admin", label: "مدیریت", icon: ShieldCheck },
    { href: "/admin/account-requests", label: "اصلاح اطلاعات حساب", icon: Settings },
    { href: "/admin/pharmacy", label: "درخواست‌های دارو", icon: Truck },
    { href: "/admin/integrations", label: "اتصال سامانه‌ها", icon: Scan },
    { href: "/admin/users", label: "کاربران", icon: Users },
    { href: "/admin/doctors", label: "پزشکان", icon: Stethoscope },
    { href: "/admin/centers", label: "مراکز درمانی", icon: Building2 },
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

export function getWorkspaceNavigation(user) {
  if (user?.role !== "medical_center") return NAVIGATION_BY_ROLE[user?.role] || [];
  const config = CENTER_TYPES[user.center_type];
  if (!config || user.center_active !== true) return [];
  const base = centerBase(user.center_type);
  return [
    {href: base+"/dashboard", label: "خانهٔ "+config.label, icon: LayoutDashboard},
    {href: base+"/requests", label: config.queue, icon: ClipboardList},
    {href: base+"/calendar", label: "تقویم نوبت‌ها", icon: CalendarDays},
    {href: base+"/reports", label: config.report, icon: FileText},
  ];
}
export function getWorkspaceBrand(user) {
  return user?.role === "medical_center" ? {label: CENTER_TYPES[user.center_type]?.label || "مرکز درمانی", icon: Building2} : ROLE_BRAND[user?.role] || {};
}
