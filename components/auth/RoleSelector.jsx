import {
  ChevronLeft,
  FlaskConical,
  Stethoscope,
  User,
} from "lucide-react";

import { LOGIN_ROLES } from "@/features/auth/config";
import visualStyles from "./auth-card.module.css";

const ROLE_ICONS = {
  patient: User,
  doctor: Stethoscope,
  laboratory: FlaskConical,
};

export default function RoleSelector({ onSelect }) {
  return (
    <ul className="space-y-3">
      {LOGIN_ROLES.map((item, index) => {
        const Icon = ROLE_ICONS[item.role];

        return (
          <li key={item.role}>
            <button
              type="button"
              onClick={() => onSelect(item.role)}
              style={{ "--auth-delay": `${index * 55}ms` }}
              className={`${visualStyles.option} group relative flex min-h-[4.6rem] w-full items-center gap-4 rounded-2xl border border-border/80 bg-background/55 p-4 text-start transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/55 hover:shadow-[0_12px_30px_-25px_hsl(var(--primary)/0.7)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none`}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.085] text-primary ring-1 ring-primary/10 transition-transform duration-200 group-hover:scale-[1.04] motion-reduce:transition-none">
                <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              </span>

              <span className="min-w-0 space-y-1">
                <span className="block text-base font-medium leading-none">
                  {item.label}
                </span>

                <span className="block text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>

              <ChevronLeft
                className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
