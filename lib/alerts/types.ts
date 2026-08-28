export type AlertSeverity = "critical" | "warning" | "info";

export type AlertDomain =
  | "kitchen"
  | "it"
  | "appliances"
  | "generator"
  | "solar"
  | "utilities"
  | "tenants";

export type OpsAlert = {
  id: string;
  domain: AlertDomain;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};
