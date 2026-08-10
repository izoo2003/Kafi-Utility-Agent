import type { OpsAlert } from "@/lib/alerts/types";

function appBaseUrl() {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function formatAlertDigest(alerts: OpsAlert[]) {
  const base = appBaseUrl();
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;

  const subjectParts = [
    critical ? `${critical} critical` : null,
    warning ? `${warning} warning` : null,
  ].filter(Boolean);
  const subject = `Facility Ops alerts: ${subjectParts.join(", ") || `${alerts.length} open`}`;

  const lines = [
    "Facility Ops — open alerts that need attention:",
    "",
    ...alerts.map((a, i) => {
      const link = `${base}${a.href}`;
      return [
        `${i + 1}. [${a.severity.toUpperCase()}] ${a.title}`,
        `   ${a.detail}`,
        `   Domain: ${a.domain} · ${link}`,
      ].join("\n");
    }),
    "",
    `Dashboard: ${base}/dashboard`,
  ];

  const text = lines.join("\n");

  const htmlItems = alerts
    .map((a) => {
      const link = `${base}${a.href}`;
      return `<li style="margin-bottom:12px"><strong>[${a.severity.toUpperCase()}] ${escapeHtml(a.title)}</strong><br/><span>${escapeHtml(a.detail)}</span><br/><a href="${link}">Open ${a.domain}</a></li>`;
    })
    .join("");

  const html = `<p>Facility Ops — open alerts that need attention:</p><ol>${htmlItems}</ol><p><a href="${base}/dashboard">Open dashboard</a></p>`;

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
