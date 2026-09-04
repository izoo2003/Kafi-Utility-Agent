export const IMPORT_TARGETS = [
  "kitchen-inventory",
  "it-equipment",
  "appliances",
  "appliances-clifton-office",
  "appliances-gondpass-mill",
  "generator-maintenance",
  "generator-fuel",
  "generator-expenses",
  "generator-runs",
  "generator-vendors",
  "solar-specs",
  "solar-monitoring",
  "solar-maintenance",
  "utilities",
  "tenants",
  "tenant-rent",
  "tenant-electricity",
  "chart-of-accounts",
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
    case "appliances":
    case "appliances-clifton-office":
    case "appliances-gondpass-mill": {
      const site =
        target === "appliances-gondpass-mill"
          ? "gondpass_mill (GondPass Mill)"
          : target === "appliances-clifton-office"
            ? "clifton_office (Clifton Office)"
            : "clifton_office or gondpass_mill (required — infer from the document or user wording)";
      return [
        target === "appliances"
          ? "IMPORT TARGET: Appliances register."
          : `IMPORT TARGET: Appliances register for ${site} ONLY.`,
        "Read every page/photo carefully. Extract EVERY distinct appliance row.",
        "For EACH row call appliances_create with confirmed=false (one tool call per row).",
        `ALWAYS set site to ${site}.`,
        "Map: asset tag → asset_tag; item/name → item_name; category (AC, fridge, microwave, etc.); assigned to → assigned_to; serial; purchase date; warranty expiry; status; location; notes.",
        "Dates are DD/MM/YYYY. Skip headers/blank lines. Do not write to other domains. Do not upload warranty card photos — dashboard only.",
      ].join(" ");
    }
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
    case "generator-runs":
      return [
        "IMPORT TARGET: Generator outage / run log ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct generator run / outage row.",
        "For EACH row call generator_run_log_create with confirmed=false (one tool call per row).",
        "Map: date → run_date (DD/MM/YYYY); hours / hrs / duration → hours_run; start/end times if present; remarks → notes.",
        "Skip headers/totals/blank lines. Do not write fuel, expenses, or maintenance.",
      ].join(" ");
    case "generator-vendors":
      return [
        "IMPORT TARGET: Generator vendors ONLY.",
        "Extract EVERY distinct vendor/contact row.",
        "For EACH row call generator_vendors_create with confirmed=false (one tool call per row).",
        "Map: name → name; phone / mobile / contact → phone; remarks → notes.",
        "Skip headers/blank lines. Do not write maintenance or other generator logs.",
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
    case "solar-maintenance":
      return [
        "IMPORT TARGET: Solar service / maintenance ONLY.",
        "Read every page/photo carefully. Extract EVERY distinct service/maintenance row.",
        "For EACH row call solar_maintenance_create with confirmed=false (one tool call per row).",
        "ALWAYS set site_id to the plant: Good We Office → kafi-commodities; Sungrow Office → sungrow-office; KMP Home Solar → nizam-energy. Old names (Kafi Commodities Solar, Sungrow Office Solar, Nizam Solar Energy, KMP Home Sungrow) also resolve.",
        "Map: date → service_date (DD/MM/YYYY); type → service_type; vendor; cost; remarks → notes; checkup_status done/not_done.",
        "If next_service_due missing, omit it (defaults to +1 month). Skip headers/totals/blank lines. Do not write monitoring or specs.",
      ].join(" ");
    case "utilities":
      return [
        "IMPORT TARGET: Internet & utility accounts / bill payments ONLY.",
        "Follow the same mapping as seeded dashboard logs.",
        "ALWAYS call utility_accounts_list first, then utility_payment_create (confirmed=false) with the matching account id.",
        "Providers (exact labels): K-Electric — SURWAY NO 239G Mill | K-Electric — SURWAY NO 234G Mill | K-Electric — Clifton Office | K-Electric — KMP House | SSGC (Gas) — Clifton Office | SSGC (Gas) — KMP House | KWSB (Water Board) — Clifton Office | Water tanker — Home | Water tanker — Office | Water tanker — SURWAY NO 239G Mill | Water tanker — SURWAY NO 234G Mill | Drinking water — Clifton Office | PTCL — Office | PTCL — KMP House | Jazz monthly bill — Khalid Paracha | Jazz monthly bill — Sadia Paracha.",
        "Map: due date → paid_on; amount within due → amount; KE units kWh or SSGC CM or tanker count → units_kwh; month/cycle → bill_period; invoice/Bill ID/Consumer ID → invoice_number; put customer/mobile/account clues in notes.",
        "KE: 239/234 Baldia mills by survey no; Clifton vs KMP House by address. SSGC: Block 8 / Qasre Faisal → Clifton; DHA / KMP house → KMP House. KWSB: Clifton only. Water tanker: Home / Office / 239G Mill / 234G Mill. Drinking water: Clifton Office only. PTCL: Office vs KMP House by address/user. Jazz: KP/Khalid/03008206633 → Khalid Paracha; SKP/Sadia/03218206633 → Sadia Paracha.",
        "One payment create per bill PDF or image. Never invent providers or passwords. Do not write to other domains.",
      ].join(" ");
    case "tenants":
      return [
        "IMPORT TARGET: Tenant accounts ONLY.",
        "Extract EVERY distinct tenant row.",
        "For EACH tenant call tenants_create with confirmed=false (one tool call per tenant).",
        "Map: tenant/name → tenant_name; survey/surway → survey_no; agreement from → contract_start_date; agreement to → contract_end_date;",
        "security deposit → security_deposit_amount; deposit bank → security_deposit_bank_name; deposit account → security_deposit_bank_account; cheque → security_deposit_cheque_no;",
        "sqft; rate; if lum sum set rate_type=lum_sum and gross_rent to the monthly amount, else rate_type=per_sqft (gross_rent = sqft * rate); notes.",
        "If an agreement PDF/photo is attached, set attach_agreement=true.",
        "Dates are DD/MM/YYYY. Skip headers/blank lines. Do not write electricity bills unless they are clearly extra KE bill rows.",
      ].join(" ");
    case "tenant-rent":
      return [
        "IMPORT TARGET: Tenant rent receipts ONLY.",
        "ALWAYS call tenants_list (and tenant_schedule_list if needed) first so you can resolve tenant_name and the ledger month.",
        "For EACH payment row call tenant_rent_payment_create with confirmed=false.",
        "Map: tenant name → tenant_name; month/date → month_date; amount received → amount_received; cheque → cheque_no; from bank → payer_bank_name; from account → payer_bank_account; to bank → payee_bank_name; to account → payee_bank_account; slip/TID → payment_reference.",
        "If a payment receipt PDF/photo is attached, set attach_payment=true.",
        "Dates are DD/MM/YYYY. Do not create new tenants unless the name is clearly missing from tenants_list — then tenants_create first.",
        "Do not write electricity bills.",
      ].join(" ");
    case "tenant-electricity":
      return [
        "IMPORT TARGET: Tenant electricity (K-Electric) meter bills ONLY.",
        "ALWAYS call tenants_list first so you can resolve tenant_name.",
        "For EACH bill row call tenant_electric_bill_create with confirmed=false.",
        "Map: tenant name → tenant_name; From / start date → period_from; To / end date → period_to;",
        "Last reading → last_reading; Current reading → current_reading; Rate (incl. govt) → rate_inclusive_govt;",
        "Amount received → amount_received; Date received / payment date → payment_date; notes.",
        "Consumed units and Amount are calculated automatically — do not invent them unless readings/rate are missing.",
        "If a bill PDF/photo is attached for a row, set attach_bill=true.",
        "Dates are DD/MM/YYYY. These are tenant-billed KE charges, NOT site utility meters (239G/234G/Clifton/KMP).",
        "Do not write rent logs or utility_payment_create.",
      ].join(" ");
    case "chart-of-accounts":
      return [
        "IMPORT TARGET: Chart of Accounts ledger ONLY.",
        "Extract EVERY distinct ledger row (not totals).",
        "For EACH row call chart_of_accounts_entry_create with confirmed=false.",
        "Set ledger from the current section or document title: Solar Panel Clifton → solar_panel_clifton; E.O.B.I / EOBI → eobi; K-Electric Gondpass → k_electric_gondpass; KWSB / K.W & S.B Clifton → kwsb_clifton.",
        "Map: Date → entry_date (DD/MM/YYYY); Ref No → ref_no; Accounts / Description → account_description; Document # → document_no; Debit → debit; Credit → credit.",
        "Skip Starting/Ending Date headers, Total, and Reporting Period Total rows. Keep Opening Balance and year-close rows.",
        "Do not write to utilities, tenants, generator, or other domains.",
      ].join(" ");
  }
}
