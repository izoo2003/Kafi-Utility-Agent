import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { WRITE_TOOL_NAMES } from "@/lib/validations/agent-writes";
import { agentWriteTools } from "@/lib/agent/write-tools";

export { WRITE_TOOL_NAMES };

const agentReadTools: FunctionDeclaration[] = [
  {
    name: "ops_alerts_list",
    description:
      "List current site alerts: kitchen out/low/projected-empty stock, IT warranty expiry, generator service due, solar alert flags, utility bills, tenant rent and tenant electricity dues. Use for status summaries.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "kitchen_inventory_list",
    description:
      "List kitchen inventory with qty_in (In), qty_out (Out), current_qty (Stock = In − Out), status (out|low|watch|ok), reorder_statement, daily_usage_estimate, days_remaining_estimate. Use before refill adjustments.",
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
    description:
      "Get one kitchen inventory item by id (includes In / Out / Stock).",
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
    name: "kitchen_monthly_consumption",
    description:
      "Kitchen EDA analytics for a month (YYYY-MM): KPIs, alerts, top Out items, category mix, 6-month trend, stock health, plus monthly In/Out report. Set with_ai_summary=true for AI exploratory insights (findings, risks, trends, actions).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        month: {
          type: SchemaType.STRING,
          description: "YYYY-MM (defaults to current site month)",
        },
        with_ai_summary: {
          type: SchemaType.BOOLEAN,
          description:
            "If true, generate AI EDA insights from the analytics payload.",
        },
      },
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
          description: "Max rows to return (default 40, max 200). Response includes total and truncated.",
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
          description: "Max rows to return (default 40, max 200). Response includes total and truncated.",
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
          description: "Max rows to return (default 40, max 200). Response includes total and truncated.",
        },
      },
    },
  },
  {
    name: "solar_energy_summary",
    description:
      "Monthly Solar Energy Summary for one SEMS+ plant: generated units, consumed units, units exported to grid, MoM comparison, 6-month trend, and alerts. Set with_ai_summary=true for a written AI monthly briefing. month format YYYY-MM. Use site_id (e.g. kafi-commodities, nizam-energy) when multiple plants are configured.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site_id: {
          type: SchemaType.STRING,
          description:
            "Solar site slug (defaults to the first configured site). Examples: kafi-commodities, nizam-energy.",
        },
        month: {
          type: SchemaType.STRING,
          description: "YYYY-MM (defaults to current site month)",
        },
        with_ai_summary: {
          type: SchemaType.BOOLEAN,
          description:
            "If true, also generate an AI monthly energy summary briefing.",
        },
      },
    },
  },
  {
    name: "solar_live_get",
    description:
      "Get the latest SEMS+ live plant snapshot (PV/load/grid/battery power, SOC, today generation/consumption) for one configured solar site. Does not call SEMS directly — reads the last polled snapshot from the database. Use site_id when multiple plants exist.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site_id: {
          type: SchemaType.STRING,
          description:
            "Solar site slug (defaults to first site). Examples: kafi-commodities, nizam-energy.",
        },
      },
    },
  },
  {
    name: "utility_accounts_list",
    description:
      "List utility accounts with ids and exact provider labels used by the Utilities dashboard (K-Electric sites, SSGC sites, KWSB Clifton, PTCL Office/KMP House, Jazz Khalid/Sadia). Call this BEFORE utility_payment_create so you can map a bill PDF or image to the correct utility_account_id. Never returns passwords.",
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
  {
    name: "tenants_list",
    description:
      "List tenant accounts with current rent snapshot: tenant_name, rent_amount, rent_due_date, payment_status, payment_date, outstanding_amount. Call this BEFORE tenant_rent_log_create or tenant_electric_bill_create so you can map a name to tenant_id.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name_contains: {
          type: SchemaType.STRING,
          description: "Optional case-insensitive name filter",
        },
      },
    },
  },
  {
    name: "tenants_get",
    description: "Get one tenant by id or tenant_name, including current rent fields.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "Tenant UUID" },
        tenant_name: {
          type: SchemaType.STRING,
          description: "Exact or close tenant name",
        },
      },
    },
  },
  {
    name: "tenant_rent_logs_list",
    description:
      "List rent payment history for tenants (due date, amount, status, payment date, outstanding). Filter by tenant_id or tenant_name.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenant_id: { type: SchemaType.STRING },
        tenant_name: { type: SchemaType.STRING },
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 40, max 200). Response includes total and truncated.",
        },
      },
    },
  },
  {
    name: "tenant_electric_bills_list",
    description:
      "List tenant electricity (K-Electric) bills: tenant name, KE charges, due date, payment status, payment date, outstanding. Filter by tenant_id or tenant_name. These are tenant-billed KE charges, not site utility meters.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenant_id: { type: SchemaType.STRING },
        tenant_name: { type: SchemaType.STRING },
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 40, max 200). Response includes total and truncated.",
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
