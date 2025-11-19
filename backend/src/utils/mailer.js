// backend/src/utils/mailer.js
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT = 587,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = '"GPX" <no-reply@example.com>',
  EMAIL_ENABLED,
} = process.env;

const emailEnabled =
  String(EMAIL_ENABLED || "false").toLowerCase() === "true";

let transporter = null;

if (
  emailEnabled &&
  SMTP_HOST &&
  SMTP_USER &&
  SMTP_PASS
) {
  const port = Number(SMTP_PORT);
  const secure = port === 465; // 465=SSL, 587=STARTTLS

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    requireTLS: !secure,
    logger: true,
    debug: true,
  });

  console.log("[mail] EMAIL_ENABLED=true, transporter created");
} else {
  console.log(
    "[mail] EMAIL_ENABLED=false หรือ SMTP config ไม่ครบ → จะไม่ส่งอีเมลจริง (simulate send only)"
  );
}

/**
 * ส่งอีเมล (ถ้า transporter ไม่มี จะ log แล้วคืนค่าเฉย ๆ)
 */
async function sendMail({ to, subject, html, text }) {
  // โหมดปิดเมล / ไม่มี config → แค่ log แล้ว return
  if (!transporter) {
    console.log(
      "[mail] Skip sending email (disabled or no transporter).",
      { to, subject }
    );
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log("[mail] Sent ok:", info.messageId || "");
    return info;
  } catch (err) {
    console.error("[mail] Send error:", err);
    // ไม่โยน error ต่อ เพื่อไม่ให้ไปทำให้ API พัง
    return { error: err };
  }
}

module.exports = { sendMail };
