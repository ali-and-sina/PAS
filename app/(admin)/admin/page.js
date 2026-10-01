import Link from "next/link";
import { FlaskConical, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export const metadata = { title: "خانه" };

const SECTIONS = [
  {
    href: "/admin/doctors",
    label: "مدیریت پزشکان",
    description: "لیست پزشکان و افزودن پزشک جدید",
    icon: Users,
  },
  {
    href: "/admin/laboratories",
    label: "مدیریت آزمایشگاه‌ها",
    description: "لیست آزمایشگاه‌ها و افزودن آزمایشگاه جدید",
    icon: FlaskConical,
  },
];

export default function AdminHomePage() {
  return (
    <>
      <PageHeader
        title="پنل مدیریت"
        description="مدیریت پزشکان و آزمایشگاه‌های ثبت‌شده در سامانه."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="space-y-1">
              <span className="block font-medium leading-none">{label}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
