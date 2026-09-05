/** Parent dashboard path when browser history cannot go back. */
export function dashboardParentPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/dashboard";
  if (trimmed === "/dashboard") return "/dashboard";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length <= 1) return "/dashboard";
  parts.pop();
  const parent = `/${parts.join("/")}`;
  return parent || "/dashboard";
}

export function canUseHistoryBack(pathname: string): boolean {
  if (typeof window === "undefined") return false;
  const idx = window.history.state?.idx;
  if (typeof idx === "number" && idx > 0) return true;
  try {
    if (!document.referrer) return false;
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin && ref.pathname !== pathname;
  } catch {
    return false;
  }
}
