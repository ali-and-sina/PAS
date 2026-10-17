import { cn } from "@/lib/utils";

export default function SectionCard({ title, description, action, className, children }) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-4 sm:p-5", className)}>
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&>*]:max-w-full">
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
