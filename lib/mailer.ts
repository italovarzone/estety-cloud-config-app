// lib/mailer.ts - Brevo via SMTP (mais compatível com Next.js)
import nodemailer from "nodemailer";

type SendOpts = { tenantId?: string; tags?: string[] };

function createTransport() {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.BREVO_SMTP_PORT || "587", 10);
  const user = process.env.BREVO_SMTP_USER || process.env.BREVO_SMTP_LOGIN || process.env.BREVO_API_KEY || "";
  const pass = process.env.BREVO_SMTP_PASS || process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_API_KEY || "";

  if (!user || !pass) {
    console.warn("[mailer] SMTP credenciais ausentes; e-mail desativado.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendMail(to: string, subject: string, html: string, name = "", opts: SendOpts = {}) {
  try {
    const transporter = createTransport();
    const fromEmail = process.env.BREVO_FROM_EMAIL || "estetycloud@gmail.com";
    const fromName = process.env.BREVO_FROM_NAME || "Estety Cloud";

    const info = await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: [{ address: to, name: name || undefined }],
      subject,
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || subject,
      headers: opts.tags?.length ? { "X-Tags": opts.tags.join(",") } : undefined,
    });

    console.log(`📧 [EMAIL] ${opts.tenantId ? `[${opts.tenantId}] ` : ""}${to} (${subject}) enviado: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error("❌ Erro ao enviar e-mail SMTP:", error?.message || error);
    return false;
  }
}
