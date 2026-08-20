import { NavIcon } from "@/components/dashboard/nav-icon";
import type { NavAccent } from "@/lib/dashboard/nav";

export function PageHeader({
  title,
  description,
  icon,
  accent = "slate",
}: {
  title: string;
  description?: string;
  icon?:
    | "home"
    | "chat"
    | "kitchen"
    | "it"
    | "generator"
    | "solar"
    | "utilities"
    | "tenants";
  accent?: NavAccent;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      {icon ? (
        <NavIcon
          name={icon}
          accent={accent}
          size="md"
          className="sm:hidden"
        />
      ) : null}
      {icon ? (
        <NavIcon
          name={icon}
          accent={accent}
          size="lg"
          className="hidden sm:inline-flex"
        />
      ) : null}
      <div className="min-w-0 space-y-1.5 sm:space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-[oklch(0.24_0.03_230)] sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-[oklch(0.45_0.02_230)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
