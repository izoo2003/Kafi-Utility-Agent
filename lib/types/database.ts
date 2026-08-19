/**
 * Row types for Supabase tables (Phase 0 hand-authored; regenerate later if desired).
 * Matches supabase/migrations/20260808120000_phase0_foundation.sql
 */

export type Uuid = string;
export type IsoDate = string; // YYYY-MM-DD
export type IsoTimestamptz = string;

export type AuditColumns = {
  id: Uuid;
  created_at: IsoTimestamptz;
  updated_at: IsoTimestamptz;
  updated_by: Uuid | null;
};

export type KitchenInventory = AuditColumns & {
  item_name: string;
  category: string | null;
  unit: string | null;
  /** Cumulative stock received (In). */
  qty_in: number;
  /** Cumulative stock finished/consumed (Out). */
  qty_out: number;
  /** Current stock = qty_in - qty_out. */
  current_qty: number;
  reorder_level: number;
  reorder_qty: number | null;
  supplier: string | null;
  cost_per_unit: number | null;
  last_restocked_at: IsoDate | null;
  /** Last site date auto daily consumption was applied. */
  last_auto_decrement_on: IsoDate | null;
  notes: string | null;
};

export type KitchenConsumptionLog = {
  id: Uuid;
  created_at: IsoTimestamptz;
  kitchen_item_id: Uuid;
  applied_on: IsoDate;
  qty_before: number;
  qty_after: number;
  qty_delta: number;
  reason: string;
  notes: string | null;
};

/** Derived — not stored in DB */
export type KitchenInventoryStatus = "out" | "low" | "watch" | "ok";

export type ItEquipmentStatus = "active" | "in_repair" | "retired";

export type ItEquipment = AuditColumns & {
  asset_tag: string;
  item_name: string;
  category: string | null;
  assigned_to: string | null;
  serial_number: string | null;
  purchase_date: IsoDate | null;
  warranty_expiry: IsoDate | null;
  status: ItEquipmentStatus;
  location: string | null;
  notes: string | null;
};

export type GeneratorCheckupStatus = "done" | "not_done";

export type GeneratorMaintenance = AuditColumns & {
  service_date: IsoDate;
  next_service_due: IsoDate | null;
  service_type: string | null;
  vendor: string | null;
  cost: number | null;
  notes: string | null;
  /** Monthly checkup completed (done) or still pending (not_done). */
  checkup_status: GeneratorCheckupStatus;
  /** Hour-meter reading at service time (oil-change interval tracking). */
  hour_meter: number | null;
};

export type GeneratorFuelLog = AuditColumns & {
  log_date: IsoDate;
  liters_added: number | null;
  running_hours: number | null;
  fuel_level_pct: number | null;
  cost: number | null;
  notes: string | null;
};

/** Manual generator run during an outage (not live telemetry). */
export type GeneratorRunLog = AuditColumns & {
  run_date: IsoDate;
  hours_run: number;
  started_at: IsoTimestamptz | null;
  ended_at: IsoTimestamptz | null;
  notes: string | null;
};

/** Ledger-style generator expenses (debit totaled for total expense). */
export type GeneratorExpense = AuditColumns & {
  expense_date: IsoDate;
  account: string | null;
  description: string | null;
  debit: number;
  credit: number | null;
  notes: string | null;
};

export type SolarSpecs = AuditColumns & {
  panel_capacity_kw: number | null;
  inverter_model: string | null;
  battery_capacity_kwh: number | null;
  install_date: IsoDate | null;
  vendor: string | null;
  warranty_expiry: IsoDate | null;
  /** Inverter warranty / expiry date */
  inverter_expiry: IsoDate | null;
  /** Battery warranty / expiry date */
  battery_expiry: IsoDate | null;
  spec_file_url: string | null;
};

export type SolarMonitoringLog = AuditColumns & {
  log_date: IsoDate;
  generation_kwh: number | null;
  consumption_kwh: number | null;
  /** AC generation used on-site (kWh). */
  to_load_kwh: number | null;
  /** AC generation exported to grid (kWh). */
  to_grid_kwh: number | null;
  /** Consumption from grid import (kWh). */
  from_grid_kwh: number | null;
  /** Consumption covered by PV and/or battery (kWh). */
  from_pv_bat_kwh: number | null;
  battery_soc_pct: number | null;
  alert_flag: boolean;
  notes: string | null;
};

/** Latest polled SEMS+ plant telemetry (one row per station). */
export type SolarLiveSnapshot = {
  id: Uuid;
  created_at: IsoTimestamptz;
  updated_at: IsoTimestamptz;
  station_id: string;
  station_name: string | null;
  fetched_at: IsoTimestamptz;
  pv_power_kw: number | null;
  load_power_kw: number | null;
  grid_power_kw: number | null;
  battery_power_kw: number | null;
  battery_soc_pct: number | null;
  generation_today_kwh: number | null;
  consumption_today_kwh: number | null;
  raw: Record<string, unknown> | null;
  last_error: string | null;
};

export type SolarLiveSnapshotUpsert = {
  station_id: string;
  station_name?: string | null;
  fetched_at?: IsoTimestamptz;
  pv_power_kw?: number | null;
  load_power_kw?: number | null;
  grid_power_kw?: number | null;
  battery_power_kw?: number | null;
  battery_soc_pct?: number | null;
  generation_today_kwh?: number | null;
  consumption_today_kwh?: number | null;
  raw?: Record<string, unknown> | null;
  last_error?: string | null;
};

export type UtilityType =
  | "internet"
  | "electricity"
  | "gas"
  | "water"
  | "mobile";

export type UtilityAccount = AuditColumns & {
  utility_type: UtilityType;
  provider: string | null;
  account_number: string | null;
  billing_cycle: string | null;
  monthly_avg_cost: number | null;
  due_date_day: number | null;
  contact_person: string | null;
  notes: string | null;
};

export type UtilityPaymentLog = AuditColumns & {
  utility_account_id: Uuid;
  paid_on: IsoDate;
  amount: number | null;
  units_kwh: number | null;
  bill_period: string | null;
  invoice_number: string | null;
  bill_file_url: string | null;
  notes: string | null;
};

export type AlertNotificationChannel = "email" | "console";

export type AlertNotification = {
  alert_id: string;
  domain: "kitchen" | "it" | "generator" | "solar" | "utilities";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  channel: AlertNotificationChannel;
  last_sent_at: IsoTimestamptz;
  send_count: number;
  created_at: IsoTimestamptz;
};

export type AlertNotificationInsert = {
  alert_id: string;
  domain: AlertNotification["domain"];
  severity: AlertNotification["severity"];
  title: string;
  detail: string;
  channel: AlertNotificationChannel;
  last_sent_at?: IsoTimestamptz;
  send_count?: number;
};

export type Database = {
  public: {
    Tables: {
      kitchen_inventory: { Row: KitchenInventory; Insert: KitchenInventoryInsert; Update: KitchenInventoryUpdate };
      it_equipment: { Row: ItEquipment; Insert: ItEquipmentInsert; Update: ItEquipmentUpdate };
      generator_maintenance: { Row: GeneratorMaintenance; Insert: GeneratorMaintenanceInsert; Update: GeneratorMaintenanceUpdate };
      generator_fuel_log: { Row: GeneratorFuelLog; Insert: GeneratorFuelLogInsert; Update: GeneratorFuelLogUpdate };
      generator_run_log: {
        Row: GeneratorRunLog;
        Insert: GeneratorRunLogInsert;
        Update: GeneratorRunLogUpdate;
      };
      generator_expenses: { Row: GeneratorExpense; Insert: GeneratorExpenseInsert; Update: GeneratorExpenseUpdate };
      solar_specs: { Row: SolarSpecs; Insert: SolarSpecsInsert; Update: SolarSpecsUpdate };
      solar_monitoring_log: { Row: SolarMonitoringLog; Insert: SolarMonitoringLogInsert; Update: SolarMonitoringLogUpdate };
      solar_live_snapshot: {
        Row: SolarLiveSnapshot;
        Insert: SolarLiveSnapshotUpsert;
        Update: Partial<SolarLiveSnapshotUpsert>;
      };
      utility_accounts: { Row: UtilityAccount; Insert: UtilityAccountInsert; Update: UtilityAccountUpdate };
      utility_payment_logs: {
        Row: UtilityPaymentLog;
        Insert: UtilityPaymentLogInsert;
        Update: UtilityPaymentLogUpdate;
      };
      alert_notifications: {
        Row: AlertNotification;
        Insert: AlertNotificationInsert;
        Update: Partial<AlertNotificationInsert>;
      };
    };
  };
};

type OmitAuditOnWrite<T> = Omit<T, "id" | "created_at" | "updated_at">;

export type KitchenInventoryInsert = Partial<OmitAuditOnWrite<KitchenInventory>> & {
  item_name: string;
};
export type KitchenInventoryUpdate = Partial<OmitAuditOnWrite<KitchenInventory>>;

export type ItEquipmentInsert = Partial<OmitAuditOnWrite<ItEquipment>> & {
  asset_tag: string;
  item_name: string;
};
export type ItEquipmentUpdate = Partial<OmitAuditOnWrite<ItEquipment>>;

export type GeneratorMaintenanceInsert = Partial<OmitAuditOnWrite<GeneratorMaintenance>> & {
  service_date: IsoDate;
};
export type GeneratorMaintenanceUpdate = Partial<OmitAuditOnWrite<GeneratorMaintenance>>;

export type GeneratorFuelLogInsert = Partial<OmitAuditOnWrite<GeneratorFuelLog>> & {
  log_date: IsoDate;
};
export type GeneratorFuelLogUpdate = Partial<OmitAuditOnWrite<GeneratorFuelLog>>;

export type GeneratorRunLogInsert = Partial<OmitAuditOnWrite<GeneratorRunLog>> & {
  run_date: IsoDate;
  hours_run: number;
};
export type GeneratorRunLogUpdate = Partial<OmitAuditOnWrite<GeneratorRunLog>>;

export type GeneratorExpenseInsert = Partial<OmitAuditOnWrite<GeneratorExpense>> & {
  expense_date: IsoDate;
};
export type GeneratorExpenseUpdate = Partial<OmitAuditOnWrite<GeneratorExpense>>;

export type SolarSpecsInsert = Partial<OmitAuditOnWrite<SolarSpecs>>;
export type SolarSpecsUpdate = Partial<OmitAuditOnWrite<SolarSpecs>>;

export type SolarMonitoringLogInsert = Partial<OmitAuditOnWrite<SolarMonitoringLog>> & {
  log_date: IsoDate;
};
export type SolarMonitoringLogUpdate = Partial<OmitAuditOnWrite<SolarMonitoringLog>>;

export type UtilityAccountInsert = Partial<OmitAuditOnWrite<UtilityAccount>> & {
  utility_type: UtilityType;
};
export type UtilityAccountUpdate = Partial<OmitAuditOnWrite<UtilityAccount>>;

export type UtilityPaymentLogInsert = Partial<
  OmitAuditOnWrite<UtilityPaymentLog>
> & {
  utility_account_id: Uuid;
  paid_on: IsoDate;
};
export type UtilityPaymentLogUpdate = Partial<
  OmitAuditOnWrite<UtilityPaymentLog>
>;

export const SOLAR_SPECS_BUCKET = "solar-specs" as const;
export const UTILITY_BILLS_BUCKET = "utility-bills" as const;
