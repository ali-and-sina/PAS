import { cn } from "@/lib/utils";

export default function SectionCard({ title, description, action, className, children }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
