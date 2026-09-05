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
  /** Supabase Storage path for the warranty card photo/PDF */
  warranty_card_url: string | null;
};

export type ApplianceStatus = ItEquipmentStatus;

export type ApplianceSite = "clifton_office" | "gondpass_mill";

export type Appliance = AuditColumns & {
  site: ApplianceSite;
  asset_tag: string;
  item_name: string;
  category: string | null;
  assigned_to: string | null;
  serial_number: string | null;
  purchase_date: IsoDate | null;
  warranty_expiry: IsoDate | null;
  status: ApplianceStatus;
  location: string | null;
  notes: string | null;
  /** Supabase Storage path for the warranty card photo/PDF */
  warranty_card_url: string | null;
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

/** Person responsible for generator maintenance. */
export type GeneratorVendor = AuditColumns & {
  name: string;
  phone: string | null;
  notes: string | null;
};

export type ChartOfAccountsLedger =
  | "solar_panel_clifton"
  | "eobi"
  | "k_electric_gondpass"
  | "kwsb_clifton";

/** Chart of Accounts subsidiary ledger lines. Running balance is computed. */
export type ChartOfAccountsEntry = AuditColumns & {
  ledger: ChartOfAccountsLedger;
  entry_date: IsoDate;
  ref_no: string | null;
  account_description: string | null;
  document_no: string | null;
  debit: number;
  credit: number;
  notes: string | null;
};

export type SolarCheckupStatus = "done" | "not_done";

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

/** Service / maintenance row for one solar plant. */
export type SolarMaintenance = AuditColumns & {
  site_id: string;
  service_date: IsoDate;
  next_service_due: IsoDate | null;
  service_type: string | null;
  vendor: string | null;
  cost: number | null;
  notes: string | null;
  checkup_status: SolarCheckupStatus;
};

export type SolarMonitoringLog = AuditColumns & {
  station_id: string;
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
  ai_summary: string | null;
  ai_summary_model: string | null;
  ai_summary_at: IsoTimestamptz | null;
};

export type TenantPaymentStatus =
  | "paid"
  | "unpaid"
  | "partial"
  | "overdue"
  | "processing";

export type TenantRateType = "per_sqft" | "lum_sum";
export type TenantClassification = "official" | "unofficial";

export type TenantRentLineItemSnapshot = {
  label: string;
  amount: number;
};

export type Tenant = AuditColumns & {
  tenant_name: string;
  survey_no: string | null;
  /** International digits, e.g. 923001234567. Used for click-to-chat rent reminders. */
  whatsapp_number: string | null;
  classification: TenantClassification;
  contract_start_date: IsoDate | null;
  contract_end_date: IsoDate | null;
  security_deposit_amount: number | null;
  security_deposit_bank_account: string | null;
  security_deposit_bank_name: string | null;
  security_deposit_cheque_no: string | null;
  sqft: number | null;
  rate: number | null;
  rate_type: TenantRateType;
  gross_rent: number | null;
  contract_detail: string | null;
  /** Deprecated snapshot — kept for migration compatibility. */
  rent_amount: number | null;
  rent_due_date: IsoDate | null;
  payment_status: TenantPaymentStatus;
  payment_date: IsoDate | null;
  outstanding_amount: number | null;
  /** Prefer contract_end_date; kept in sync on write. */
  agreement_expiry: IsoDate | null;
  agreement_file_url: string | null;
  payment_file_url: string | null;
  notes: string | null;
};

export type TenantRentLineItem = AuditColumns & {
  tenant_id: Uuid;
  label: string;
  amount: number;
  sort_order: number;
};

export type TenantRentSchedule = AuditColumns & {
  tenant_id: Uuid;
  serial_no: number;
  period_year: number;
  period_month: number;
  period_start: IsoDate;
  period_end: IsoDate;
  survey_no: string | null;
  sqft: number | null;
  rate: number | null;
  rate_type: TenantRateType;
  gross_rent: number | null;
  line_items: TenantRentLineItemSnapshot[];
  withholding_tax: number;
  total_due: number;
};

export type TenantRentPayment = AuditColumns & {
  schedule_id: Uuid;
  amount_received: number;
  payer_bank_account: string | null;
  payer_bank_name: string | null;
  payee_bank_account: string | null;
  payee_bank_name: string | null;
  cheque_no: string | null;
  payment_reference: string | null;
  payment_file_url: string | null;
};

export type TenantRentLog = AuditColumns & {
  tenant_id: Uuid;
  rent_amount: number | null;
  rent_due_date: IsoDate | null;
  payment_status: TenantPaymentStatus;
  payment_date: IsoDate | null;
  outstanding_amount: number | null;
  payment_file_url: string | null;
  notes: string | null;
};

export type TenantElectricBill = AuditColumns & {
  tenant_id: Uuid;
  period_from: IsoDate | null;
  period_to: IsoDate | null;
  months: number | null;
  last_reading: number | null;
  current_reading: number | null;
  consumed_units: number | null;
  rate_inclusive_govt: number | null;
  ke_charges_amount: number | null;
  due_date: IsoDate | null;
  payment_status: TenantPaymentStatus;
  payment_date: IsoDate | null;
  amount_received: number | null;
  outstanding_amount: number | null;
  bill_file_url: string | null;
  notes: string | null;
};

export type WithholdingTaxSlab = AuditColumns & {
  label: string | null;
  min_amount: number;
  max_amount: number | null;
  rate_percent: number;
  notes: string | null;
};

export type TenantContractExtensionChange = {
  field: "rate_type" | "sqft" | "rate" | "gross_rent" | "line_items";
  label: string;
  old_value: unknown;
  new_value: unknown;
};

export type TenantContractExtension = AuditColumns & {
  tenant_id: string;
  extension_from: IsoDate;
  extension_till: IsoDate;
  changes: TenantContractExtensionChange[];
  notes: string | null;
  previous_contract_end_date: IsoDate | null;
};

export type AlertNotificationChannel = "email" | "console";

export type AlertNotification = {
  alert_id: string;
  domain:
    | "kitchen"
    | "it"
    | "appliances"
    | "generator"
    | "solar"
    | "utilities"
    | "tenants";
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
      appliances: { Row: Appliance; Insert: ApplianceInsert; Update: ApplianceUpdate };
      generator_maintenance: { Row: GeneratorMaintenance; Insert: GeneratorMaintenanceInsert; Update: GeneratorMaintenanceUpdate };
      generator_fuel_log: { Row: GeneratorFuelLog; Insert: GeneratorFuelLogInsert; Update: GeneratorFuelLogUpdate };
      generator_run_log: {
        Row: GeneratorRunLog;
        Insert: GeneratorRunLogInsert;
        Update: GeneratorRunLogUpdate;
      };
      generator_expenses: { Row: GeneratorExpense; Insert: GeneratorExpenseInsert; Update: GeneratorExpenseUpdate };
      generator_vendors: { Row: GeneratorVendor; Insert: GeneratorVendorInsert; Update: GeneratorVendorUpdate };
      chart_of_accounts_entries: {
        Row: ChartOfAccountsEntry;
        Insert: ChartOfAccountsEntryInsert;
        Update: ChartOfAccountsEntryUpdate;
      };
      solar_specs: { Row: SolarSpecs; Insert: SolarSpecsInsert; Update: SolarSpecsUpdate };
      solar_monitoring_log: { Row: SolarMonitoringLog; Insert: SolarMonitoringLogInsert; Update: SolarMonitoringLogUpdate };
      solar_maintenance: {
        Row: SolarMaintenance;
        Insert: SolarMaintenanceInsert;
        Update: SolarMaintenanceUpdate;
      };
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
      tenants: { Row: Tenant; Insert: TenantInsert; Update: TenantUpdate };
      tenant_rent_line_items: {
        Row: TenantRentLineItem;
        Insert: TenantRentLineItemInsert;
        Update: TenantRentLineItemUpdate;
      };
      tenant_rent_schedule: {
        Row: TenantRentSchedule;
        Insert: TenantRentScheduleInsert;
        Update: TenantRentScheduleUpdate;
      };
      tenant_rent_payments: {
        Row: TenantRentPayment;
        Insert: TenantRentPaymentInsert;
        Update: TenantRentPaymentUpdate;
      };
      tenant_rent_logs: {
        Row: TenantRentLog;
        Insert: TenantRentLogInsert;
        Update: TenantRentLogUpdate;
      };
      tenant_electric_bills: {
        Row: TenantElectricBill;
        Insert: TenantElectricBillInsert;
        Update: TenantElectricBillUpdate;
      };
      withholding_tax_slabs: {
        Row: WithholdingTaxSlab;
        Insert: WithholdingTaxSlabInsert;
        Update: WithholdingTaxSlabUpdate;
      };
      tenant_contract_extensions: {
        Row: TenantContractExtension;
        Insert: TenantContractExtensionInsert;
        Update: TenantContractExtensionUpdate;
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

export type ApplianceInsert = Partial<OmitAuditOnWrite<Appliance>> & {
  asset_tag: string;
  item_name: string;
  site: ApplianceSite;
};
export type ApplianceUpdate = Partial<OmitAuditOnWrite<Appliance>>;

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

export type GeneratorVendorInsert = Partial<OmitAuditOnWrite<GeneratorVendor>> & {
  name: string;
};
export type GeneratorVendorUpdate = Partial<OmitAuditOnWrite<GeneratorVendor>>;

export type ChartOfAccountsEntryInsert = Partial<
  OmitAuditOnWrite<ChartOfAccountsEntry>
> & {
  ledger: ChartOfAccountsLedger;
  entry_date: IsoDate;
};
export type ChartOfAccountsEntryUpdate = Partial<
  OmitAuditOnWrite<ChartOfAccountsEntry>
>;

export type SolarSpecsInsert = Partial<OmitAuditOnWrite<SolarSpecs>>;
export type SolarSpecsUpdate = Partial<OmitAuditOnWrite<SolarSpecs>>;

export type SolarMaintenanceInsert = Partial<OmitAuditOnWrite<SolarMaintenance>> & {
  site_id: string;
  service_date: IsoDate;
};
export type SolarMaintenanceUpdate = Partial<OmitAuditOnWrite<SolarMaintenance>>;

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

export type TenantInsert = Partial<OmitAuditOnWrite<Tenant>> & {
  tenant_name: string;
};
export type TenantUpdate = Partial<OmitAuditOnWrite<Tenant>>;

export type TenantRentLineItemInsert = Partial<
  OmitAuditOnWrite<TenantRentLineItem>
> & {
  tenant_id: Uuid;
  label: string;
};
export type TenantRentLineItemUpdate = Partial<
  OmitAuditOnWrite<TenantRentLineItem>
>;

export type TenantRentScheduleInsert = Partial<
  OmitAuditOnWrite<TenantRentSchedule>
> & {
  tenant_id: Uuid;
  serial_no: number;
  period_year: number;
  period_month: number;
  period_start: IsoDate;
  period_end: IsoDate;
};
export type TenantRentScheduleUpdate = Partial<
  OmitAuditOnWrite<TenantRentSchedule>
>;

export type TenantRentPaymentInsert = Partial<
  OmitAuditOnWrite<TenantRentPayment>
> & {
  schedule_id: Uuid;
};
export type TenantRentPaymentUpdate = Partial<
  OmitAuditOnWrite<TenantRentPayment>
>;

export type TenantRentLogInsert = Partial<OmitAuditOnWrite<TenantRentLog>> & {
  tenant_id: Uuid;
};
export type TenantRentLogUpdate = Partial<OmitAuditOnWrite<TenantRentLog>>;

export type TenantElectricBillInsert = Partial<
  OmitAuditOnWrite<TenantElectricBill>
> & {
  tenant_id: Uuid;
};
export type TenantElectricBillUpdate = Partial<
  OmitAuditOnWrite<TenantElectricBill>
>;

export type WithholdingTaxSlabInsert = Partial<
  OmitAuditOnWrite<WithholdingTaxSlab>
> & {
  rate_percent: number;
};
export type WithholdingTaxSlabUpdate = Partial<
  OmitAuditOnWrite<WithholdingTaxSlab>
>;

export type TenantContractExtensionInsert = Partial<
  OmitAuditOnWrite<TenantContractExtension>
> & {
  tenant_id: string;
  extension_from: IsoDate;
  extension_till: IsoDate;
};
export type TenantContractExtensionUpdate = Partial<
  OmitAuditOnWrite<TenantContractExtension>
>;

export const SOLAR_SPECS_BUCKET = "solar-specs" as const;
export const UTILITY_BILLS_BUCKET = "utility-bills" as const;
export const WARRANTY_CARDS_BUCKET = "warranty-cards" as const;
export const TENANT_DOCUMENTS_BUCKET = "tenant-documents" as const;
