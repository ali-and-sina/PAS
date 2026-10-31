import { Activity } from "lucide-react";

export default function DashboardWelcome({ title, description, eyebrow, actions }) {
  return <section className="relative isolate overflow-hidden rounded-3xl border border-primary/15 bg-accent/70 p-5 sm:p-7">
    <div aria-hidden="true" className="pas-hero-pattern pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2" />
    <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-primary"><Activity className="size-4" aria-hidden="true" />{eyebrow || "امروز در پاس"}</p>
        <h1 className="text-2xl font-bold leading-relaxed sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto">{actions}</div>}
    </div>
  </section>;
}
