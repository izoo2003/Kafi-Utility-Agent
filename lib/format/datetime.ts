/** Site timezone for display (Pakistan). Fixed locale avoids SSR/client hydration mismatches. */
const SITE_TIME_ZONE = "Asia/Karachi";
const SITE_LOCALE = "en-GB";

/** Short local datetime for tables / history. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(SITE_LOCALE, {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Display dates as DD/MM/YYYY (site convention). */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[1]!.padStart(2, "0")}/${dmy[2]!.padStart(2, "0")}/${dmy[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}
