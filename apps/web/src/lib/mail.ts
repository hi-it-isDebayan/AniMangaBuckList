const FROM_DEFAULT = "AniManga BuckList <no-reply@animanga.debayandas.in>";

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      `[mail] RESEND_API_KEY not set — skipped sending "${opts.subject}" to ${opts.to}.`,
    );
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? FROM_DEFAULT,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend email error ${res.status}: ${body.slice(0, 200)}`);
  }
  return true;
}