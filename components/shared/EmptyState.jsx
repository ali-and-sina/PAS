import { Inbox } from "lucide-react";
import Link from "next/link";
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
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/20 px-5 py-10 text-center sm:py-12">
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-card text-primary"><Icon className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
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
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
