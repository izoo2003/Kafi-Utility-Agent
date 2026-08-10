import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailToUsername } from "@/lib/auth/username";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const username =
    (user.user_metadata?.username as string | undefined) ??
    emailToUsername(user.email ?? "");

  return <DashboardShell username={username}>{children}</DashboardShell>;
}
