export const IMPORT_TARGETS = [
  "kitchen-inventory",
  "it-equipment",
  "generator-maintenance",
  "generator-fuel",
  "generator-expenses",
  "solar-specs",
  "solar-monitoring",
  "utilities",
] as const;

export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export function isImportTarget(value: string): value is ImportTarget {
  return (IMPORT_TARGETS as readonly string[]).includes(value);
}

/**
 * Explicit section prompts so Gemini maps every visible row into the right tools.
 */
export function importPromptFor(target: ImportTarget): string {
  switch (target) {
    case "kitchen-inventory":
      return [
        "IMPORT TARGET: Kitchen inventory ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct stock/item row from the PDF/image.",
        "For EACH row call kitchen_inventory_create with confirmed=false (one tool call per row).",
        "Map: item name → item_name; category; unit; current qty → current_qty; reorder level → reorder_level; reorder qty → reorder_qty; supplier; cost → cost_per_unit; notes.",
        "Skip headers/totals/blank lines. Dates are DD/MM/YYYY when present.",
        "Do not write to other domains.",
      ].join(" ");
    case "it-equipment":
      return [
        "IMPORT TARGET: IT equipment register ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct asset row.",
        "For EACH row call it_equipment_create with confirmed=false (one tool call per row).",
        "Map: asset tag → asset_tag; item/name → item_name; category; assigned to → assigned_to; serial; purchase date; warranty expiry; status; location; notes.",
        "Dates are DD/MM/YYYY. Skip headers/blank lines. Do not write to other domains.",
      ].join(" ");
    case "generator-maintenance":
      return [
        "IMPORT TARGET: Generator maintenance ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct maintenance/service row.",
        "For EACH row call generator_maintenance_create with confirmed=false (one tool call per row).",
        "For these sheets, content columns that matter are Accounts → service_type and Description → notes.",
        "Also set service_date from the row date (DD/MM/YYYY). Ignore debit/credit unless user asks for cost.",
        "If next_service_due missing, omit it (defaults to +1 month). checkup_status=done when clearly completed.",
        "Skip headers/totals/blank lines. Do not write expenses or fuel.",
      ].join(" ");
    case "generator-fuel":
      return [
        "IMPORT TARGET: Generator fuel log ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct fuel fill / log row.",
        "For EACH row call generator_fuel_log_create with confirmed=false (one tool call per row).",
        "REQUIRED when visible on the sheet — do not leave these null if the cell/value is readable:",
        "date → log_date (DD/MM/YYYY);",
        "Litres/Liters/L/Qty(L)/Fuel added → liters_added (number only);",
        "Running hours/Hrs/HMR/Hour meter/Engine hours → running_hours;",
        "Level %/Fuel %/Tank %/Fuel level → fuel_level_pct (0-100, strip % sign);",
        "Cost/Amount/Debit/Price → cost; Remarks/Description → notes.",
        "Accept British 'litres' and American 'liters'. Read handwritten and printed digits carefully.",
        "Skip headers/totals/blank lines. Do not write expenses or maintenance.",
      ].join(" ");
    case "generator-expenses":
      return [
        "IMPORT TARGET: Generator expenses ledger ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct expense/ledger row with a debit (or amount).",
        "For EACH row call generator_expense_create with confirmed=false (one tool call per row).",
        "Map: date → expense_date (DD/MM/YYYY); Accounts → account; Description → description; Debit → debit; Credit → credit if present.",
        "Skip headers, blank lines, and total-only summary lines. Total expense is sum of debit.",
        "Do not write fuel logs or maintenance.",
      ].join(" ");
    case "solar-specs":
      return [
        "IMPORT TARGET: Solar system specs ONLY.",
        "Read every page/photo (nameplates, install docs, spec sheets).",
        "Create or update solar specs via solar_specs_create / solar_specs_update with confirmed=false.",
        "Map: panel capacity kW → panel_capacity_kw; inverter model; battery kWh → battery_capacity_kwh; install date (DD/MM/YYYY); vendor; warranty expiry; inverter expiry → inverter_expiry; battery expiry → battery_expiry; notes in free text fields as available.",
        "If multiple distinct systems/rows appear, one create per distinct system. Do not write monitoring logs.",
      ].join(" ");
    case "solar-monitoring":
      return [
        "IMPORT TARGET: Solar monitoring logs ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct daily/monitoring row.",
        "For EACH row call solar_monitoring_create with confirmed=false (one tool call per row).",
        "Map: date → log_date (DD/MM/YYYY); generation kWh → generation_kwh; consumption kWh → consumption_kwh; battery % → battery_soc_pct; alert flag; notes.",
        "Skip headers/totals/blank lines. Do not write solar specs.",
      ].join(" ");
    case "utilities":
      return [
        "IMPORT TARGET: Internet & utility accounts / bill payments ONLY.",
        "Follow the same mapping as seeded dashboard logs.",
        "ALWAYS call utility_accounts_list first, then utility_payment_create (confirmed=false) with the matching account id.",
        "Providers (exact labels): K-Electric — SURWAY NO 239G Mill | K-Electric — SURWAY NO 234G Mill | K-Electric — Clifton Office | K-Electric — KMP House | SSGC (Gas) — Clifton Office | SSGC (Gas) — KMP House | KWSB (Water Board) — Clifton Office | PTCL — Office | PTCL — KMP House | Jazz monthly bill — Khalid Paracha | Jazz monthly bill — Sadia Paracha.",
        "Map: due date → paid_on; amount within due → amount; KE units kWh or SSGC CM → units_kwh; month/cycle → bill_period; invoice/Bill ID/Consumer ID → invoice_number; put customer/mobile/account clues in notes.",
        "KE: 239/234 Baldia mills by survey no; Clifton vs KMP House by address. SSGC: Block 8 / Qasre Faisal → Clifton; DHA / KMP house → KMP House. KWSB: Clifton only. PTCL: Office vs KMP House by address/user. Jazz: KP/Khalid/03008206633 → Khalid Paracha; SKP/Sadia/03218206633 → Sadia Paracha.",
        "One payment create per bill PDF or image. Never invent providers or passwords. Do not write to other domains.",
      ].join(" ");
  }
}
