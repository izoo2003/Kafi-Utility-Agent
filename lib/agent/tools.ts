import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { WRITE_TOOL_NAMES } from "@/lib/validations/agent-writes";
import { agentWriteTools } from "@/lib/agent/write-tools";

export { WRITE_TOOL_NAMES };

const agentReadTools: FunctionDeclaration[] = [
  {
    name: "ops_alerts_list",
    description:
      "List current site alerts: kitchen out/low/projected-empty stock, IT warranty expiry, generator service due, solar alert flags, utility bills. Use for status summaries.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "kitchen_inventory_list",
    description:
      "List kitchen inventory with qty, status (out|low|watch|ok), reorder_statement (dated human notice), daily_usage_estimate, and days_remaining_estimate. Use before refill adjustments.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        low_only: {
          type: SchemaType.BOOLEAN,
          description:
            "If true, only return out, low, or watch (projected empty soon) items.",
        },
      },
    },
  },
  {
    name: "kitchen_inventory_get",
    description: "Get one kitchen inventory item by id.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: {
          type: SchemaType.STRING,
          description: "Kitchen inventory row UUID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "it_equipment_list",
    description:
      "List IT equipment assets (asset tag, status, assignment, warranty).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["active", "in_repair", "retired"],
          description: "Optional status filter",
        },
      },
    },
  },
  {
    name: "it_equipment_get",
    description: "Get one IT equipment record by id or asset_tag.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: {
          type: SchemaType.STRING,
          description: "Equipment row UUID",
        },
        asset_tag: {
          type: SchemaType.STRING,
          description: "Unique asset tag",
        },
      },
    },
  },
  {
    name: "generator_maintenance_list",
    description:
      "List generator maintenance records (newest first) plus schedule summary: next_maintenance_due, last_maintenance_done, and pending not_done status. Cadence is monthly (~1 month).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 20)",
        },
      },
    },
  },
  {
    name: "generator_fuel_log_list",
    description: "List generator fuel log entries, newest first.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 20)",
        },
      },
    },
  },
  {
    name: "generator_expense_list",
    description:
      "List generator expense ledger rows and total_debit (sum of debit = total expense). Newest dates first.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 50)",
        },
      },
    },
  },
  {
    name: "solar_specs_list",
    description: "List solar system specification records.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "solar_monitoring_list",
    description: "List solar monitoring log entries.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        alerts_only: {
          type: SchemaType.BOOLEAN,
          description: "If true, only rows with alert_flag true.",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 20)",
        },
      },
    },
  },
  {
    name: "solar_live_get",
    description:
      "Get the latest SEMS+ live plant snapshot (PV/load/grid/battery power, SOC, today generation/consumption). Does not call SEMS directly — reads the last polled snapshot from the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "utility_accounts_list",
    description:
      "List utility accounts with ids and exact provider labels used by the Utilities dashboard (K-Electric sites, SSGC sites, KWSB Clifton, Jazz Khalid/Sadia). Call this BEFORE utility_payment_create so you can map a bill PDF to the correct utility_account_id. Never returns passwords.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        utility_type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["internet", "electricity", "gas", "water"],
        },
      },
    },
  },
];

/** Gemini function declarations — reads + full CRUD writes */
export const agentTools: FunctionDeclaration[] = [
  ...agentReadTools,
  ...agentWriteTools,
];

export function isWriteTool(name: string): boolean {
  return (WRITE_TOOL_NAMES as readonly string[]).includes(name);
}
