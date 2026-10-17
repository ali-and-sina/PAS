import { cn } from "@/lib/utils";

/**
 * @param {{ title: string, description?: string, actions?: React.ReactNode, className?: string }} props
 */
export default function PageHeader({ title, description, actions, className }) {
  return (
    <header
      className={cn(
        "mb-5 flex min-w-0 flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl break-words text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&>*]:max-w-full">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
