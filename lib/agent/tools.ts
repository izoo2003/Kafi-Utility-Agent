import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { WRITE_TOOL_NAMES } from "@/lib/validations/agent-writes";
import { agentWriteTools } from "@/lib/agent/write-tools";

export { WRITE_TOOL_NAMES };

const agentReadTools: FunctionDeclaration[] = [
  {
    name: "ops_alerts_list",
    description:
      "List current site alerts: kitchen out/low/projected-empty stock, IT and appliance warranty expiry, generator service due, solar alert flags, utility bills, tenant rent and tenant electricity dues. Use for status summaries.",
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
    name: "appliances_list",
    description:
      "List appliances at Clifton Office (clifton_office) and/or GondPass Mill (gondpass_mill). Filter by site. warranty_card_url is a storage path when a card photo exists (dashboard upload only).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
          description:
            "Required when asking about one location. Clifton Office → clifton_office; GondPass Mill → gondpass_mill.",
        },
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
    name: "appliances_get",
    description:
      "Get one appliance by id, or by asset_tag (pass site when the tag might exist at both locations).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: {
          type: SchemaType.STRING,
          description: "Appliance row UUID",
        },
        asset_tag: {
          type: SchemaType.STRING,
          description: "Asset tag",
        },
        site: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["clifton_office", "gondpass_mill"],
          description: "clifton_office (Clifton Office) or gondpass_mill (GondPass Mill)",
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
    name: "generator_run_log_list",
    description:
      "List generator outage/run log entries (manual, not live), newest first. Hours from these runs add up toward the 200 h oil change.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 40, max 200).",
        },
      },
    },
  },
  {
    name: "generator_vendors_list",
    description:
      "List people responsible for generator maintenance (name, phone, notes). Call before assigning a vendor on a maintenance record.",
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
    name: "generator_vendors_get",
    description: "Get one generator vendor by id or name.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "Vendor UUID" },
        name: {
          type: SchemaType.STRING,
          description: "Exact or close vendor name",
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
    name: "solar_maintenance_list",
    description:
      "List solar service/maintenance records (newest first) plus schedule summary: next_maintenance_due, last_maintenance_done, and pending not_done. Cadence is monthly (~1 month). Filter by site_id or plant name: Good We Office (kafi-commodities), Sungrow Office (sungrow-office), KMP Home Solar (nizam-energy).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        site_id: {
          type: SchemaType.STRING,
          description:
            "Plant slug or display name. Examples: Good We Office, Sungrow Office, KMP Home Solar.",
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
            "Solar site slug or display name (defaults to the first configured site). Examples: Good We Office, Sungrow Office, KMP Home Solar.",
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
            "Solar site slug or display name (defaults to first site). Examples: Good We Office, Sungrow Office, KMP Home Solar.",
        },
      },
    },
  },
  {
    name: "utility_accounts_list",
    description:
      "List utility accounts with ids and exact provider labels used by the Utilities dashboard (K-Electric sites, SSGC sites, KWSB Clifton, Water tanker Home/Office/239G/234G, Drinking water Clifton, PTCL Office/KMP House, Jazz Khalid/Sadia). Call this BEFORE utility_payment_create so you can map a bill PDF or image to the correct utility_account_id. Never returns passwords.",
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
    name: "utility_bill_summary",
    description:
      "Bill summary for one utility account: this bill vs previous (amount, units, period, % difference) plus recent history. Default is numbers + any cached AI report. Set generate=true to write a fresh AI report (why this bill, vs previous, difference). Resolve the account first with utility_accounts_list (exact provider labels).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        utility_account_id: {
          type: SchemaType.STRING,
          description: "Utility account UUID from utility_accounts_list",
        },
        provider: {
          type: SchemaType.STRING,
          description:
            "Exact dashboard provider label, e.g. K-Electric — Clifton Office, Water tanker — Home",
        },
        generate: {
          type: SchemaType.BOOLEAN,
          description:
            "If true, generate (or refresh) the AI report. If false/omitted, return comparison numbers and cached summary only.",
        },
      },
    },
  },
  {
    name: "tenants_list",
    description:
      "List tenant accounts with contract dates, survey no, gross rent, monthly total, outstanding ledger balance, and agreement_days_remaining. Call this BEFORE tenant_rent_payment_create or tenant_electric_bill_create so you can map a name to tenant_id.",
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
    description:
      "Get one tenant by id or tenant_name, including contract terms and a monthly schedule preview (due, received, balance).",
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
    name: "tenant_schedule_list",
    description:
      "List the monthly rent ledger for tenants (month, gross rent, extra charges, received, balance). Filter by tenant_id or tenant_name.",
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
      "List tenant electricity (K-Electric) bills: period from/to, months, readings, consumed units, rate, amount, amount received, date received, status, outstanding. Filter by tenant_id or tenant_name. These are tenant-billed KE charges, not site utility meters.",
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
    name: "chart_of_accounts_list",
    description:
      "List Chart of Accounts ledger entries. ledger is required: solar_panel_clifton | eobi | k_electric_gondpass | kwsb_clifton. Returns rows oldest-first with running balance, debit/credit totals, and closing balance.",
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
          description:
            "solar_panel_clifton = Solar Panel Clifton Office; eobi = E.O.B.I; k_electric_gondpass = K-Electric Gondpass; kwsb_clifton = KWSB Clifton Office",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Max rows to return (default 50, max 200)",
        },
      },
      required: ["ledger"],
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
