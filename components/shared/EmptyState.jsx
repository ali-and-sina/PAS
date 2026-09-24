import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{ title: string, description?: string, icon?: import("react").ComponentType, action?: {label:string, onClick?:()=>void, href?:string} }} props
 */
export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action &&
        (action.href ? (
          <Button asChild size="sm" className="mt-2">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button size="sm" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
