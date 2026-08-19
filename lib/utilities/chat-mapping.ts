/**
 * Canonical utility-bill → account mapping for chat imports.
 * Keep in sync with SITE_UTILITY_PROVIDERS / seeded payment logs.
 */

export const UTILITY_CHAT_BILL_MAPPING = `
Utility bill PDFs via chat (must match dashboard sections exactly):

ALWAYS call utility_accounts_list FIRST, then utility_payment_create with that account's id (confirmed=false).
Never create a duplicate account if the correct provider label already exists.
Use paid_on = due date within due date from the bill when the bill is the current cycle being logged (same convention as seeded logs). Next due = paid_on + 1 month.

Field mapping (same as dashboard / seed scripts):
- paid_on ← due date (within due date) or explicit paid date if stated
- amount ← amount payable within / before due date (not after-due surcharge total unless that is the only figure)
- units_kwh ← KE billed units (kWh) OR SSGC measured CM; omit for Jazz / KWSB when not on bill
- bill_period ← billing month / cycle (e.g. Jul-26, Jul-2026, 02/07/2026–01/08/2026)
- invoice_number ← KE Invoice No, SSGC Bill ID, KWSB Consumer ID, Jazz Invoice No
- notes ← short summary: customer name, account/consumer no, mobile (Jazz), address clue, meter if present

Issuer → section mapping (use address / account / customer name on the PDF):
1) K-Electric (KE / e-bill / "KAFI COMMODITIES" industrial OR residential KE):
   - "239" / "S.NO 239" / Hub River Road Baldia industrial large load → provider "K-Electric — SURWAY NO 239G Mill"
   - "234" / "SURVEY NO 234" / Gond Pass Baldia → "K-Electric — SURWAY NO 234G Mill"
   - Defence / Muhafiz / Phase-VI residential KE (Khalid Mehmood Paracha / KMP house) → prefer "K-Electric — KMP House" if address is house; "K-Electric — Clifton Office" if clearly Clifton office. If ambiguous, ask the user which KE site.
   - Clifton office KE meter → "K-Electric — Clifton Office"
2) SSGC (gas):
   - "Qasre Faisal" / Block 8 Clifton / KAFI COMMODITIES gas → "SSGC (Gas) — Clifton Office"
   - House / Phase VI / Muhafiz / Khalid Mehmood Paracha home gas → "SSGC (Gas) — KMP House"
3) KWSB (water board) — ONE site only:
   - Always "KWSB (Water Board) — Clifton Office" (A.Karim Sons / F.50/1 Block-8 Clifton). There is NO KMP House KWSB section.
4) Jazz mobile:
   - Filename/user says KP, or name KHALID MEHMOOD PARACHA, mobile 03008206633, customer 72373646 → "Jazz monthly bill — Khalid Paracha"
   - Filename/user says SKP, or name SADIA KHALID PARACHA, mobile 03218206633, customer 163401563 → "Jazz monthly bill — Sadia Paracha"
Do not create or log PTCL (removed from Utilities).

If multiple PDFs are attached in one message, propose one utility_payment_create per bill (one Confirm each), each mapped independently.
Match provider string EXACTLY to utility_accounts_list.provider (including the em dash "—").
`.trim();
