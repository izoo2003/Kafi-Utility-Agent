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
      "Add or remove stock on a kitchen item by delta (preferred for refills). Example: refilled 2 packs of tea → delta=+2. Used 1 soap → delta=-1. Looks up by id from kitchen_inventory_list. Sets last_restocked_at when delta>0. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        delta: {
          type: SchemaType.NUMBER,
          description:
            "Positive to refill/add stock, negative to record manual use. Non-zero.",
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
    description: "Create a solar monitoring log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        log_date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        generation_kwh: { type: SchemaType.NUMBER },
        consumption_kwh: { type: SchemaType.NUMBER },
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
    description: "Update a solar monitoring log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        log_date: { type: SchemaType.STRING },
        generation_kwh: { type: SchemaType.NUMBER },
        consumption_kwh: { type: SchemaType.NUMBER },
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
            "Prefer: K-Electric — SURWAY NO 239G Mill | K-Electric — SURWAY NO 234G Mill | K-Electric — Clifton Office | K-Electric — KMP House | SSGC (Gas) — Clifton Office | SSGC (Gas) — KMP House | KWSB (Water Board) — Clifton Office | PTCL — Office | PTCL — KMP House | Jazz monthly bill — Khalid Paracha | Jazz monthly bill — Sadia Paracha",
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
      "Log a utility bill payment with the same fields as the Utilities dashboard (amount, units_kwh, bill_period, invoice_number, notes). Next due = paid_on + 1 month. ALWAYS resolve utility_account_id via utility_accounts_list using exact provider labels (e.g. Jazz monthly bill — Khalid Paracha, SSGC (Gas) — Clifton Office, K-Electric — SURWAY NO 239G Mill). Requires confirmation. Chat extracts fields from attached PDFs; PDF file archive can be uploaded on the Utilities Log payment dialog.",
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
];
