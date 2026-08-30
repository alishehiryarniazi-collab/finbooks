import nodemailer from "nodemailer";

// Gmail is used only when SMTP_USER + SMTP_PASS (a Gmail "App Password") are set in .env.
// Without them we don't fail — we log the reset link to the server console so the flow still
// works end-to-end in development / on the demo.
const { SMTP_USER, SMTP_PASS } = process.env;

const transport =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({ service: "gmail", auth: { user: SMTP_USER, pass: SMTP_PASS } })
    : null;

export function emailConfigured(): boolean {
  return transport !== null;
}

export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
  const subject = "Reset your FinBooks password";
  const text =
    `Hi ${name},\n\n` +
    `We received a request to reset your FinBooks password.\n` +
    `Open this link to set a new password (it expires in 1 hour):\n\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">
      <h2 style="color:#0f766e">FinBooks</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your FinBooks password.</p>
      <p>
        <a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;
           padding:10px 18px;border-radius:8px;font-weight:600">Reset password</a>
      </p>
      <p style="font-size:13px;color:#64748b">This link expires in 1 hour. If you didn't request it, ignore this email — your password won't change.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${link}</p>
    </div>`;

  if (!transport) {
    // Dev / no-Gmail fallback: print the link so the user can still complete the reset.
    console.log("\n[password-reset] Email is not configured (set SMTP_USER + SMTP_PASS in .env for Gmail).");
    console.log(`[password-reset] Reset link for ${to}:\n${link}\n`);
    return;
  }

  await transport.sendMail({ from: `FinBooks <${SMTP_USER}>`, to, subject, text, html });
}
