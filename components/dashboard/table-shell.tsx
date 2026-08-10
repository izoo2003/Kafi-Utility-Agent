import { cn } from "@/lib/utils";

export function TableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-full overflow-hidden rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/75 shadow-[0_1px_0_oklch(0.9_0.02_220)] backdrop-blur-sm sm:rounded-2xl",
        className,
      )}
    >
      <p className="border-b border-[oklch(0.92_0.015_220)] px-3 py-1.5 text-[11px] text-muted-foreground sm:hidden">
        Swipe sideways to see all columns
      </p>
      {children}
    </div>
  );
}

export function TableActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {children}
    </div>
  );
}

export function CellPrimary({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-foreground" title={title}>
        {title}
      </div>
      {subtitle ? (
        <div className="truncate text-xs text-muted-foreground" title={subtitle}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export function CellText({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const tip =
    title ??
    (typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined);

  return (
    <span className="block truncate" title={tip}>
      {children}
    </span>
  );
}
