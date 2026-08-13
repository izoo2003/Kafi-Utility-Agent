export type AlertSeverity = "critical" | "warning" | "info";

export type AlertDomain =
  | "kitchen"
  | "it"
  | "generator"
  | "solar"
  | "utilities";

export type OpsAlert = {
  id: string;
  domain: AlertDomain;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};
