import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-full min-h-dvh flex-1 items-center justify-center px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 size-56 rounded-full bg-[oklch(0.85_0.06_195_/_0.35)] blur-3xl sm:size-72" />
        <div className="absolute -bottom-16 right-1/5 size-64 rounded-full bg-[oklch(0.9_0.05_85_/_0.3)] blur-3xl sm:size-80" />
      </div>
      <div className="relative w-full max-w-md space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center">
          <p className="font-heading text-xs font-semibold tracking-[0.18em] text-primary uppercase sm:text-sm">
            Facility Ops
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in
          </h1>
          <p className="px-2 text-sm text-muted-foreground sm:text-base">
            Manage kitchen, IT, generator, solar, and utilities from one place.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
