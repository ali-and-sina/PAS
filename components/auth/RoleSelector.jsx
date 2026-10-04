import {
  ChevronLeft,
  FlaskConical,
  Stethoscope,
  User,
} from "lucide-react";

import { LOGIN_ROLES } from "@/features/auth/config";

const ROLE_ICONS = {
  patient: User,
  doctor: Stethoscope,
  laboratory: FlaskConical,
};

export default function RoleSelector({ onSelect }) {
  return (
    <ul className="space-y-3">
      {LOGIN_ROLES.map((item) => {
        const Icon = ROLE_ICONS[item.role];

        return (
          <li key={item.role}>
            <button
              type="button"
              onClick={() => onSelect(item.role)}
              className="flex min-h-16 w-full items-center gap-4 rounded-lg border bg-card p-4 text-start transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon className="size-5" aria-hidden="true" />
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
                className="ms-auto size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
