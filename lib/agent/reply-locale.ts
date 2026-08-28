/** Detect Urdu script or common Roman Urdu so chat can reply in the same register. */

const URDU_SCRIPT = /[\u0600-\u06FF]/;

const ROMAN_URDU_WORD =
  /\b(mehne|maine|mein|mujhe|mera|meri|apka|apki|apke|bhai|daaldo|kia|kiya|krdia|krdi|krdo|kardo|batao|khatam|waghera|haan|haa|yeh|woh|kitna|kitni|kab|kahan|karo|kar\s*do|kar\s*dia|daal\s*dia|daal\s*diya|daal\s*do|ho\s*gaya|ho\s*gyi|log\s*pe|entry\s*kar|ya\s*bhi|ya\s*kaam)\b/i;

function isConfirmChrome(text: string) {
  return /^\s*Confirm(\s+all|:)/i.test(text.trim());
}

export function textLooksLikeUrduOrRomanUrdu(text: string) {
  const t = text.trim();
  if (!t || isConfirmChrome(t)) return false;
  return URDU_SCRIPT.test(t) || ROMAN_URDU_WORD.test(t);
}

export function prefersRomanUrduReply(
  messages: Array<{ role: string; content: string }>,
) {
  return messages.some(
    (m) => m.role === "user" && textLooksLikeUrduOrRomanUrdu(m.content),
  );
}

export function pendingRecordsReply(
  count: number,
  romanUrdu: boolean,
  fromFile: boolean,
) {
  const n = count;
  const noun = n === 1 ? "record" : "records";
  if (romanUrdu) {
    return fromFile
      ? `Haan bhai, file se ${n} ${noun} milay hain. Abhi save nahi hue — Confirm, Confirm all, ya Leave use karo.`
      : `Haan bhai, ${n} ${noun} review ke liye ready hain. Confirm, Confirm all, ya Leave use karo.`;
  }
  return fromFile
    ? `Found ${n} ${noun} from your file. Nothing is saved yet — use Confirm (one), Confirm all, or Leave below.`
    : `Found ${n} ${noun} ready to review. Use Confirm, Confirm all, or Leave below.`;
}

export function confirmedWriteReply(summary: string, romanUrdu: boolean) {
  if (romanUrdu) {
    return `Haan bhai, apka yeh kaam kar diya hai — log pe yeh entry ho gayi: ${summary}`;
  }
  return `Confirmed — ${summary}`;
}

export function confirmedBatchReply(
  total: number,
  okCount: number,
  failMessage: string | null,
  romanUrdu: boolean,
) {
  if (failMessage == null) {
    if (total === 1) return null;
    return romanUrdu
      ? `Haan bhai, tamam ${total} entries log pe add kar di hain.`
      : `Confirmed all ${total} records.`;
  }
  if (okCount === 0) {
    return romanUrdu
      ? `Bhai, confirm fail ho gaya: ${failMessage}`
      : `Confirm failed: ${failMessage}`;
  }
  return romanUrdu
    ? `Haan bhai, ${okCount} of ${total} entries ho gayin, phir fail: ${failMessage}`
    : `Confirmed ${okCount} of ${total} records, then failed: ${failMessage}`;
}
