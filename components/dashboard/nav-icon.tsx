import {
  Building2,
  ChefHat,
  Home,
  MessagesSquare,
  MonitorCog,
  PlugZap,
  SunMedium,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavAccent } from "@/lib/dashboard/nav";

const icons = {
  home: Home,
  chat: MessagesSquare,
  kitchen: ChefHat,
  it: MonitorCog,
  generator: Zap,
  solar: SunMedium,
  utilities: PlugZap,
  tenants: Building2,
} as const;

/** Soft rounded tiles — matches Domains card icons on the home screen. */
const accentStyles: Record<NavAccent, string> = {
  slate: "bg-[oklch(0.93_0.02_230)] text-[oklch(0.38_0.05_230)]",
  amber: "bg-[oklch(0.94_0.05_85)] text-[oklch(0.45_0.12_60)]",
  sky: "bg-[oklch(0.93_0.05_240)] text-[oklch(0.42_0.12_250)]",
  orange: "bg-[oklch(0.94_0.06_55)] text-[oklch(0.48_0.14_45)]",
  teal: "bg-[oklch(0.93_0.05_195)] text-[oklch(0.4_0.1_195)]",
  emerald: "bg-[oklch(0.93_0.06_155)] text-[oklch(0.4_0.12_155)]",
  violet: "bg-[oklch(0.94_0.05_300)] text-[oklch(0.42_0.14_300)]",
  rose: "bg-[oklch(0.94_0.05_350)] text-[oklch(0.45_0.14_350)]",
};

export function NavIcon({
  name,
  accent,
  className,
  size = "md",
}: {
  name: keyof typeof icons;
  accent: NavAccent;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = icons[name] as LucideIcon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200",
        accentStyles[accent],
        size === "sm" && "size-9 [&_svg]:size-[1.15rem]",
        size === "md" && "size-11 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
    >
      <Icon strokeWidth={1.75} aria-hidden />
    </span>
  );
}
