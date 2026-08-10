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
    description: "Create a generator maintenance record. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        service_date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        next_service_due: { type: SchemaType.STRING },
        service_type: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["service_date"],
    },
  },
  {
    name: "generator_maintenance_update",
    description: "Update a generator maintenance record. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        service_date: { type: SchemaType.STRING },
        next_service_due: { type: SchemaType.STRING },
        service_type: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
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
    description: "Create a generator fuel log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        log_date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        liters_added: { type: SchemaType.NUMBER },
        running_hours: { type: SchemaType.NUMBER },
        fuel_level_pct: { type: SchemaType.NUMBER },
        cost: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
        ...confirmedProperty,
      },
      required: ["log_date"],
    },
  },
  {
    name: "generator_fuel_log_update",
    description: "Update a generator fuel log entry. Requires confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ...idProp,
        log_date: { type: SchemaType.STRING },
        liters_added: { type: SchemaType.NUMBER },
        running_hours: { type: SchemaType.NUMBER },
        fuel_level_pct: { type: SchemaType.NUMBER },
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
          enum: ["internet", "electricity", "gas", "water"],
        },
        provider: { type: SchemaType.STRING },
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
          enum: ["internet", "electricity", "gas", "water"],
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
];
