import {
  Building2,
  CookingPot,
  Cpu,
  Fuel,
  Home,
  MessageSquareText,
  SunMedium,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavAccent } from "@/lib/dashboard/nav";

const icons = {
  home: Home,
  chat: MessageSquareText,
  kitchen: CookingPot,
  it: Cpu,
  generator: Fuel,
  solar: SunMedium,
  utilities: Wifi,
  tenants: Building2,
} as const;

const accentStyles: Record<NavAccent, string> = {
  slate: "bg-[oklch(0.93_0.02_230)] text-[oklch(0.38_0.05_230)]",
  amber: "bg-[oklch(0.94_0.05_85)] text-[oklch(0.45_0.12_60)]",
  sky: "bg-[oklch(0.93_0.04_230)] text-[oklch(0.42_0.1_240)]",
  orange: "bg-[oklch(0.94_0.05_55)] text-[oklch(0.48_0.14_45)]",
  teal: "bg-[oklch(0.93_0.05_185)] text-[oklch(0.4_0.1_185)]",
  emerald: "bg-[oklch(0.93_0.05_155)] text-[oklch(0.4_0.1_155)]",
  violet: "bg-[oklch(0.94_0.04_290)] text-[oklch(0.42_0.12_290)]",
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
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
    >
      <Icon strokeWidth={1.75} aria-hidden />
    </span>
  );
}
