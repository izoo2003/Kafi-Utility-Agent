import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

const confirmedProperty: {
  confirmed: {
    type: SchemaType.BOOLEAN;
    description: string;
  };
} = {
  confirmed: {
    type: SchemaType.BOOLEAN,
    description:
      "Must be false (or omitted) on the first call to preview the change. Set true only after the user explicitly confirms.",
  },
};

const idProp: {
  id: {
    type: SchemaType.STRING;
    description: string;
  };
} = {
  id: { type: SchemaType.STRING, description: "Row UUID" },
};

/** Full CRUD write tools (solar file upload excluded). */
export const agentWriteTools: FunctionDeclaration[] = [
  {
    name: "kitchen_inventory_create",
    description: "Create a kitchen inventory item. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        unit: { type: SchemaType.STRING },
        current_qty: { type: SchemaType.NUMBER },
        reorder_level: { type: SchemaType.NUMBER },
        reorder_qty: { type: SchemaType.NUMBER },
        supplier: { type: SchemaType.STRING },
        cost_per_unit: { type: SchemaType.NUMBER },
        last_restocked_at: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD",
        },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["item_name", "current_qty", "reorder_level"],
    },
  },
  {
    name: "kitchen_inventory_update",
    description:
      "Update fields on an existing kitchen inventory item. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        unit: { type: SchemaType.STRING },
        current_qty: { type: SchemaType.NUMBER },
        reorder_level: { type: SchemaType.NUMBER },
        reorder_qty: { type: SchemaType.NUMBER },
        supplier: { type: SchemaType.STRING },
        cost_per_unit: { type: SchemaType.NUMBER },
        last_restocked_at: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "kitchen_inventory_adjust_qty",
    description:
      "Record kitchen stock In or Out via delta. Stock = In − Out. Positive delta = In (refill/received). Negative delta = Out (finished/consumed). Example: refilled 2 packs tea → delta=+2. Used/finished 1 soap → delta=-1. Prefer this over editing current_qty. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        delta: {
          type: SchemaType.NUMBER,
          description:
            "Positive = In (add stock), negative = Out (consume). Non-zero.",
        },
        notes: {
          type: SchemaType.STRING,
          description: "Optional note e.g. 'Refilled 2 cartons Olpers'",
        },
        ...confirmedProperty,
      },
      required: ["id", "delta"],
    },
  },
  {
    name: "kitchen_inventory_delete",
    description: "Delete a kitchen inventory item. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "it_equipment_create",
    description: "Create an IT equipment asset. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        asset_tag: { type: SchemaType.STRING },
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        assigned_to: { type: SchemaType.STRING },
        serial_number: { type: SchemaType.STRING },
        purchase_date: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["active", "in_repair", "retired"],
        },
        location: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["asset_tag", "item_name"],
    },
  },
  {
    name: "it_equipment_update",
    description:
      "Update IT equipment by id (or asset_tag_lookup). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        asset_tag_lookup: {
          type: SchemaType.STRING,
          description: "Find row by current asset tag when id unknown",
        },
        asset_tag: { type: SchemaType.STRING },
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        assigned_to: { type: SchemaType.STRING },
        serial_number: { type: SchemaType.STRING },
        purchase_date: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["active", "in_repair", "retired"],
        },
        location: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "it_equipment_delete",
    description: "Delete IT equipment by id or asset_tag. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        asset_tag: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "appliances_create",
    description:
      "Create an appliance at Clifton Office or GondPass Mill. Requires site and confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
          description:
            "clifton_office = Clifton Office; gondpass_mill = GondPass Mill",
        },
        asset_tag: { type: SchemaType.STRING },
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        assigned_to: { type: SchemaType.STRING },
        serial_number: { type: SchemaType.STRING },
        purchase_date: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["active", "in_repair", "retired"],
        },
        location: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["site", "asset_tag", "item_name"],
    },
  },
  {
    name: "appliances_update",
    description:
      "Update an appliance by id (or asset_tag_lookup + site_lookup). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        asset_tag_lookup: {
          type: SchemaType.STRING,
          description: "Find row by current asset tag when id unknown",
        },
        site_lookup: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
          description: "Site to search when using asset_tag_lookup",
        },
        site: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
          description: "Move the appliance to this site",
        },
        asset_tag: { type: SchemaType.STRING },
        item_name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        assigned_to: { type: SchemaType.STRING },
        serial_number: { type: SchemaType.STRING },
        purchase_date: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["active", "in_repair", "retired"],
        },
        location: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "appliances_delete",
    description:
      "Delete an appliance by id or asset_tag (pass site if the tag exists at both locations). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        asset_tag: { type: SchemaType.STRING },
        site: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
        },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "generator_maintenance_create",
    description:
      "Create a generator maintenance/checkup/oil-change record. For oil changes set service_type to 'Oil change' and hour_meter to the current hour reading. Oil change is due every 200 running hours. If next_service_due is omitted for regular checkups, defaults to +1 month. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        service_date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        next_service_due: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD; defaults to +1 month from service_date",
        },
        service_type: {
          type: SchemaType.STRING,
          description: "e.g. Monthly checkup, Oil change",
        },
        hour_meter: {
          type: SchemaType.NUMBER,
          description: "Hour-meter reading at service (needed for oil change)",
        },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        checkup_status: {
          type: SchemaType.STRING,
          description: "done or not_done",
        },
        ...confirmedProperty,
      },
      required: ["service_date"],
    },
  },
  {
    name: "generator_maintenance_update",
    description:
      "Update a generator maintenance record (including checkup_status done/not_done and hour_meter). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        service_date: { type: SchemaType.STRING },
        next_service_due: { type: SchemaType.STRING },
        service_type: { type: SchemaType.STRING },
        hour_meter: { type: SchemaType.NUMBER },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        checkup_status: {
          type: SchemaType.STRING,
          description: "done or not_done",
        },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "generator_maintenance_delete",
    description: "Delete a generator maintenance record. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "generator_fuel_log_create",
    description:
      "Create a generator fuel log entry from a fuel sheet/log row. Include liters_added, running_hours, and fuel_level_pct whenever visible (litres/L, hrs/HMR, level%/tank%). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        log_date: {
          type: SchemaType.STRING,
          description: "DD/MM/YYYY or YYYY-MM-DD",
        },
        liters_added: {
          type: SchemaType.NUMBER,
          description: "Fuel added in litres/liters (from L / Qty columns)",
        },
        running_hours: {
          type: SchemaType.NUMBER,
          description: "Hour meter / running hours / HMR",
        },
        fuel_level_pct: {
          type: SchemaType.NUMBER,
          description: "Tank/fuel level percent 0-100 (strip % sign)",
        },
        cost: {
          type: SchemaType.NUMBER,
          description: "Cost/amount/debit for this fill if present",
        },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["log_date"],
    },
  },
  {
    name: "generator_fuel_log_update",
    description:
      "Update a generator fuel log entry (liters_added, running_hours, fuel_level_pct, cost, notes). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        log_date: {
          type: SchemaType.STRING,
          description: "DD/MM/YYYY or YYYY-MM-DD",
        },
        liters_added: {
          type: SchemaType.NUMBER,
          description: "Fuel added in litres/liters",
        },
        running_hours: {
          type: SchemaType.NUMBER,
          description: "Hour meter / running hours",
        },
        fuel_level_pct: {
          type: SchemaType.NUMBER,
          description: "Tank/fuel level percent 0-100",
        },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "generator_fuel_log_delete",
    description: "Delete a generator fuel log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "generator_expense_create",
    description:
      "Create a generator expense ledger row (from fuel/expense sheets). Use debit for the amount. Dates may be DD/MM/YYYY or YYYY-MM-DD. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        expense_date: {
          type: SchemaType.STRING,
          description: "DD/MM/YYYY or YYYY-MM-DD",
        },
        account: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        debit: {
          type: SchemaType.NUMBER,
          description: "Debit amount (included in total expense)",
        },
        credit: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["expense_date", "debit"],
    },
  },
  {
    name: "generator_expense_update",
    description: "Update a generator expense row. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        expense_date: { type: SchemaType.STRING },
        account: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        debit: { type: SchemaType.NUMBER },
        credit: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "generator_expense_delete",
    description: "Delete a generator expense row. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "generator_run_log_create",
    description:
      "Log a generator outage run (not live telemetry). hours_run is required; started_at/ended_at optional. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        run_date: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD or DD/MM/YYYY",
        },
        hours_run: {
          type: SchemaType.NUMBER,
          description: "Hours the generator ran during this outage",
        },
        started_at: { type: SchemaType.STRING },
        ended_at: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["run_date", "hours_run"],
    },
  },
  {
    name: "generator_run_log_update",
    description:
      "Update a generator outage run log (hours_run, times, notes). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        run_date: { type: SchemaType.STRING },
        hours_run: { type: SchemaType.NUMBER },
        started_at: { type: SchemaType.STRING },
        ended_at: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "generator_run_log_delete",
    description: "Delete a generator outage run log. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "generator_vendors_create",
    description:
      "Add a generator maintenance vendor (name, phone, notes). Matching names update the existing vendor. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["name"],
    },
  },
  {
    name: "generator_vendors_update",
    description:
      "Update a generator vendor by id or name_lookup (name, phone, notes). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        name_lookup: {
          type: SchemaType.STRING,
          description: "Find vendor by current name when id unknown",
        },
        name: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "generator_vendors_delete",
    description:
      "Delete a generator vendor by id or name_lookup. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        name_lookup: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "solar_specs_create",
    description:
      "Create a solar specs record from extracted fields (incl. from photos). File storage of originals is on the Solar dashboard. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        panel_capacity_kw: { type: SchemaType.NUMBER },
        inverter_model: { type: SchemaType.STRING },
        battery_capacity_kwh: { type: SchemaType.NUMBER },
        install_date: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        inverter_expiry: {
          type: SchemaType.STRING,
          description: "Inverter warranty/expiry date (YYYY-MM-DD or DD/MM/YYYY)",
        },
        battery_expiry: {
          type: SchemaType.STRING,
          description: "Battery warranty/expiry date (YYYY-MM-DD or DD/MM/YYYY)",
        },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "solar_specs_update",
    description:
      "Update solar specs fields (not file upload). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        panel_capacity_kw: { type: SchemaType.NUMBER },
        inverter_model: { type: SchemaType.STRING },
        battery_capacity_kwh: { type: SchemaType.NUMBER },
        install_date: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        warranty_expiry: { type: SchemaType.STRING },
        inverter_expiry: {
          type: SchemaType.STRING,
          description: "Inverter warranty/expiry date (YYYY-MM-DD or DD/MM/YYYY)",
        },
        battery_expiry: {
          type: SchemaType.STRING,
          description: "Battery warranty/expiry date (YYYY-MM-DD or DD/MM/YYYY)",
        },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "solar_specs_delete",
    description:
      "Delete a solar specs record (also removes uploaded file if present). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "solar_monitoring_create",
    description:
      "Create or update (same log_date) a solar monitoring log. Prefer updating the existing day — never duplicate the same date. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        log_date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        generation_kwh: { type: SchemaType.NUMBER },
        consumption_kwh: { type: SchemaType.NUMBER },
        to_load_kwh: {
          type: SchemaType.NUMBER,
          description: "Generation used on-site (To Load)",
        },
        to_grid_kwh: {
          type: SchemaType.NUMBER,
          description: "Generation exported to grid (To Grid)",
        },
        from_pv_bat_kwh: {
          type: SchemaType.NUMBER,
          description: "Consumption from PV and/or battery",
        },
        from_grid_kwh: {
          type: SchemaType.NUMBER,
          description: "Consumption imported from grid",
        },
        battery_soc_pct: { type: SchemaType.NUMBER },
        alert_flag: { type: SchemaType.BOOLEAN },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["log_date"],
    },
  },
  {
    name: "solar_monitoring_update",
    description:
      "Update a solar monitoring log entry. Same log_date updates that day's row (no duplicates). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        log_date: { type: SchemaType.STRING },
        generation_kwh: { type: SchemaType.NUMBER },
        consumption_kwh: { type: SchemaType.NUMBER },
        to_load_kwh: { type: SchemaType.NUMBER },
        to_grid_kwh: { type: SchemaType.NUMBER },
        from_pv_bat_kwh: { type: SchemaType.NUMBER },
        from_grid_kwh: { type: SchemaType.NUMBER },
        battery_soc_pct: { type: SchemaType.NUMBER },
        alert_flag: { type: SchemaType.BOOLEAN },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "solar_monitoring_delete",
    description: "Delete a solar monitoring log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "solar_maintenance_create",
    description:
      "Log solar service/maintenance for one plant. site_id is the plant slug or name: Good We Office (kafi-commodities), Sungrow Office (sungrow-office), KMP Home Solar (nizam-energy). If next_service_due is omitted, defaults to +1 month. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site_id: {
          type: SchemaType.STRING,
          description:
            "Plant slug or display name. Examples: Good We Office, Sungrow Office, KMP Home Solar.",
        },
        service_date: { type: SchemaType.STRING, description: "YYYY-MM-DD or DD/MM/YYYY" },
        next_service_due: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD; defaults to +1 month from service_date",
        },
        service_type: {
          type: SchemaType.STRING,
          description: "e.g. Cleaning, inverter check, Service / maintenance",
        },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        checkup_status: {
          type: SchemaType.STRING,
          description: "done or not_done",
        },
        ...confirmedProperty,
      },
      required: ["site_id", "service_date"],
    },
  },
  {
    name: "solar_maintenance_update",
    description:
      "Update a solar service/maintenance record (including checkup_status done/not_done). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        site_id: { type: SchemaType.STRING },
        service_date: { type: SchemaType.STRING },
        next_service_due: { type: SchemaType.STRING },
        service_type: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        checkup_status: {
          type: SchemaType.STRING,
          description: "done or not_done",
        },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "solar_maintenance_delete",
    description: "Delete a solar service/maintenance record. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "utility_accounts_create",
    description:
      "Create a utility account (never passwords). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        utility_type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["internet", "electricity", "gas", "water", "mobile"],
        },
        provider: {
          type: SchemaType.STRING,
          description:
            "Prefer: K-Electric — SURWAY NO 239G Mill | K-Electric — SURWAY NO 234G Mill | K-Electric — Clifton Office | K-Electric — KMP House | SSGC (Gas) — Clifton Office | SSGC (Gas) — KMP House | KWSB (Water Board) — Clifton Office | Water tanker — Home | Water tanker — Office | Water tanker — SURWAY NO 239G Mill | Water tanker — SURWAY NO 234G Mill | Drinking water — Clifton Office | PTCL — Office | PTCL — KMP House | Jazz monthly bill — Khalid Paracha | Jazz monthly bill — Sadia Paracha",
        },
        account_number: { type: SchemaType.STRING },
        billing_cycle: { type: SchemaType.STRING },
        monthly_avg_cost: { type: SchemaType.NUMBER },
        due_date_day: { type: SchemaType.NUMBER },
        contact_person: { type: SchemaType.STRING },
        notes: {
          type: SchemaType.STRING,
          description: "Password-manager entry name only",
        },
        ...confirmedProperty,
      },
      required: ["utility_type"],
    },
  },
  {
    name: "utility_accounts_update",
    description:
      "Update a utility account (never passwords). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        utility_type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["internet", "electricity", "gas", "water", "mobile"],
        },
        provider: { type: SchemaType.STRING },
        account_number: { type: SchemaType.STRING },
        billing_cycle: { type: SchemaType.STRING },
        monthly_avg_cost: { type: SchemaType.NUMBER },
        due_date_day: { type: SchemaType.NUMBER },
        contact_person: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "utility_accounts_delete",
    description: "Delete a utility account. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "utility_payment_create",
    description:
      "Log a utility bill payment with the same fields as the Utilities dashboard (amount, units_kwh, bill_period, invoice_number, notes). Next due = paid_on + 1 month. ALWAYS resolve utility_account_id via utility_accounts_list using exact provider labels (e.g. Water tanker — Home, Drinking water — Clifton Office, K-Electric — SURWAY NO 239G Mill). Requires confirmation. Chat extracts fields from attached PDFs; PDF file archive can be uploaded on the Utilities Log payment dialog.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        utility_account_id: { type: SchemaType.STRING },
        paid_on: {
          type: SchemaType.STRING,
          description:
            "Due date within due date (or paid date) as DD/MM/YYYY or YYYY-MM-DD",
        },
        amount: {
          type: SchemaType.NUMBER,
          description: "Amount payable within / before due date",
        },
        units_kwh: {
          type: SchemaType.NUMBER,
          description:
            "Units from the bill — kWh for K-Electric, cubic metres (CM) for SSGC gas; omit for Jazz/KWSB when not present",
        },
        bill_period: {
          type: SchemaType.STRING,
          description: "Billing month/cycle e.g. Jul-26 or 02/07/2026–01/08/2026",
        },
        invoice_number: {
          type: SchemaType.STRING,
          description: "KE invoice, SSGC Bill ID, KWSB Consumer ID, or Jazz Invoice No",
        },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["utility_account_id", "paid_on"],
    },
  },
  {
    name: "utility_payment_delete",
    description: "Delete a utility payment log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "tenants_create",
    description:
      "Create a tenant with contract dates, survey, WhatsApp number, deposit, sqft/rate or lum-sum gross rent, and optional extra monthly charges (line_items). Generates the monthly rent ledger. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenant_name: { type: SchemaType.STRING },
        survey_no: { type: SchemaType.STRING },
        whatsapp_number: {
          type: SchemaType.STRING,
          description: "Tenant WhatsApp: 03xx…, +92…, or 92…",
        },
        contract_start_date: {
          type: SchemaType.STRING,
          description: "Agreement start YYYY-MM-DD or DD/MM/YYYY",
        },
        contract_end_date: {
          type: SchemaType.STRING,
          description: "Agreement end YYYY-MM-DD or DD/MM/YYYY",
        },
        security_deposit_amount: { type: SchemaType.NUMBER },
        security_deposit_bank_account: { type: SchemaType.STRING },
        security_deposit_bank_name: { type: SchemaType.STRING },
        security_deposit_cheque_no: { type: SchemaType.STRING },
        sqft: { type: SchemaType.NUMBER },
        rate: { type: SchemaType.NUMBER },
        rate_type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["per_sqft", "lum_sum"],
        },
        gross_rent: { type: SchemaType.NUMBER },
        contract_detail: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        attach_agreement: {
          type: SchemaType.BOOLEAN,
          description:
            "If true, save the chat-attached agreement PDF/photo onto this tenant.",
        },
        agreement_attachment_index: {
          type: SchemaType.NUMBER,
          description: "Which attached file is the agreement (0-based). Default 0.",
        },
        ...confirmedProperty,
      },
      required: ["tenant_name", "contract_start_date", "contract_end_date"],
    },
  },
  {
    name: "tenants_update",
    description:
      "Update a tenant account by id (or tenant_name_lookup). Changing contract dates or rent terms rebuilds the monthly ledger; set regenerate_schedule=true if payments already exist. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        tenant_name_lookup: {
          type: SchemaType.STRING,
          description: "Find tenant by current name when id unknown",
        },
        tenant_name: { type: SchemaType.STRING },
        survey_no: { type: SchemaType.STRING },
        whatsapp_number: {
          type: SchemaType.STRING,
          description: "Tenant WhatsApp: 03xx…, +92…, or 92…",
        },
        contract_start_date: { type: SchemaType.STRING },
        contract_end_date: { type: SchemaType.STRING },
        security_deposit_amount: { type: SchemaType.NUMBER },
        security_deposit_bank_account: { type: SchemaType.STRING },
        security_deposit_bank_name: { type: SchemaType.STRING },
        security_deposit_cheque_no: { type: SchemaType.STRING },
        sqft: { type: SchemaType.NUMBER },
        rate: { type: SchemaType.NUMBER },
        rate_type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["per_sqft", "lum_sum"],
        },
        gross_rent: { type: SchemaType.NUMBER },
        regenerate_schedule: { type: SchemaType.BOOLEAN },
        notes: { type: SchemaType.STRING },
        attach_agreement: {
          type: SchemaType.BOOLEAN,
          description: "Save/replace the chat-attached agreement file.",
        },
        clear_agreement_file: {
          type: SchemaType.BOOLEAN,
          description: "Delete the stored agreement file.",
        },
        agreement_attachment_index: { type: SchemaType.NUMBER },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "tenants_delete",
    description:
      "Delete a tenant account and all of their rent records and electricity bills. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        tenant_name_lookup: {
          type: SchemaType.STRING,
          description: "Find tenant by name when id unknown",
        },
        ...confirmedProperty,
      },
    },
  },
  {
    name: "tenant_rent_payment_create",
    description:
      "Record an amount received against a tenant monthly ledger row. Pass schedule_id from tenant_schedule_list, or tenant_id/tenant_name plus month_date. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        schedule_id: { type: SchemaType.STRING },
        tenant_id: { type: SchemaType.STRING },
        tenant_name: { type: SchemaType.STRING },
        month_date: {
          type: SchemaType.STRING,
          description: "Any date in the billing month (YYYY-MM-DD or DD/MM/YYYY)",
        },
        amount_received: { type: SchemaType.NUMBER },
        payer_bank_name: { type: SchemaType.STRING },
        payer_bank_account: { type: SchemaType.STRING },
        payee_bank_name: { type: SchemaType.STRING },
        payee_bank_account: { type: SchemaType.STRING },
        cheque_no: { type: SchemaType.STRING },
        payment_reference: { type: SchemaType.STRING },
        attach_payment: {
          type: SchemaType.BOOLEAN,
          description: "Save the chat-attached payment receipt onto this payment.",
        },
        payment_attachment_index: { type: SchemaType.NUMBER },
        ...confirmedProperty,
      },
      required: ["amount_received"],
    },
  },
  {
    name: "tenant_electric_bill_create",
    description:
      "Log a tenant electricity (K-Electric) meter bill: period_from/period_to (months auto), last_reading, current_reading (consumed auto), rate_inclusive_govt (amount auto), amount_received, payment_date (date received). Optional attach_bill for PDF/photo. Resolve tenant via tenants_list; pass tenant_id or tenant_name. Not for site utility meters. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenant_id: { type: SchemaType.STRING },
        tenant_name: { type: SchemaType.STRING },
        period_from: { type: SchemaType.STRING },
        period_to: { type: SchemaType.STRING },
        last_reading: { type: SchemaType.NUMBER },
        current_reading: { type: SchemaType.NUMBER },
        rate_inclusive_govt: { type: SchemaType.NUMBER },
        amount_received: { type: SchemaType.NUMBER },
        payment_date: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        attach_bill: {
          type: SchemaType.BOOLEAN,
          description: "Save the chat-attached electricity bill PDF/photo onto this bill.",
        },
        bill_attachment_index: { type: SchemaType.NUMBER },
        ...confirmedProperty,
      },
      required: ["period_from", "period_to"],
    },
  },
  {
    name: "tenant_electric_bill_update",
    description:
      "Update a tenant electricity bill by id (period, readings, rate, amount received, bill file). Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        period_from: { type: SchemaType.STRING },
        period_to: { type: SchemaType.STRING },
        last_reading: { type: SchemaType.NUMBER },
        current_reading: { type: SchemaType.NUMBER },
        rate_inclusive_govt: { type: SchemaType.NUMBER },
        amount_received: { type: SchemaType.NUMBER },
        payment_date: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        attach_bill: { type: SchemaType.BOOLEAN },
        clear_bill_file: { type: SchemaType.BOOLEAN },
        bill_attachment_index: { type: SchemaType.NUMBER },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "tenant_electric_bill_delete",
    description: "Delete a tenant electricity bill. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
  {
    name: "chart_of_accounts_entry_create",
    description:
      "Create a Chart of Accounts ledger entry. ledger: solar_panel_clifton | eobi | k_electric_gondpass | kwsb_clifton. Map Date→entry_date, Ref No→ref_no, Accounts/Description→account_description, Document #→document_no, Debit→debit, Credit→credit. Dates DD/MM/YYYY or YYYY-MM-DD. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ledger: {
          type: SchemaType.STRING,
          format: "enum",
          enum: [
            "solar_panel_clifton",
            "eobi",
            "k_electric_gondpass",
            "kwsb_clifton",
          ],
        },
        entry_date: {
          type: SchemaType.STRING,
          description: "DD/MM/YYYY or YYYY-MM-DD",
        },
        ref_no: { type: SchemaType.STRING },
        account_description: { type: SchemaType.STRING },
        document_no: { type: SchemaType.STRING },
        debit: { type: SchemaType.NUMBER },
        credit: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["ledger", "entry_date"],
    },
  },
  {
    name: "chart_of_accounts_entry_update",
    description: "Update a Chart of Accounts ledger entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        ledger: {
          type: SchemaType.STRING,
          format: "enum",
          enum: [
            "solar_panel_clifton",
            "eobi",
            "k_electric_gondpass",
            "kwsb_clifton",
          ],
        },
        entry_date: { type: SchemaType.STRING },
        ref_no: { type: SchemaType.STRING },
        account_description: { type: SchemaType.STRING },
        document_no: { type: SchemaType.STRING },
        debit: { type: SchemaType.NUMBER },
        credit: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "chart_of_accounts_entry_delete",
    description: "Delete a Chart of Accounts ledger entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { ...idProp, ...confirmedProperty },
      required: ["id"],
    },
  },
];
