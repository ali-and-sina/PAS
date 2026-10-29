import { cn } from "@/lib/utils";

/**
 * @param {{ title: string, description?: string, actions?: React.ReactNode, className?: string }} props
 */
export default function PageHeader({ title, description, actions, className }) {
  return (
    <header
      className={cn(
        "mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-5",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="break-words text-2xl font-bold leading-relaxed sm:text-[1.75rem]">
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
