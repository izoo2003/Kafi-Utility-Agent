export type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  channel: "email" | "console";
  id?: string;
};

function parseRecipients(raw: string | undefined) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Send via Resend when configured; otherwise log to console (local/dev).
 * Never uses the synthetic @facility-ops.local auth email.
 */
export async function sendAlertEmail(
  payload: EmailPayload,
): Promise<SendEmailResult> {
  const to = parseRecipients(process.env.ALERT_EMAIL_TO);
  const from =
    process.env.ALERT_EMAIL_FROM?.trim() || "Facility Ops <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey || to.length === 0) {
    console.info("[notifications:console]", {
      to: to.length ? to : ["(set ALERT_EMAIL_TO)"],
      from,
      subject: payload.subject,
      text: payload.text,
    });
    return { channel: "console" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      body.error?.message ||
        body.message ||
        `Resend failed (${res.status})`,
    );
  }

  return { channel: "email", id: body.id };
}
