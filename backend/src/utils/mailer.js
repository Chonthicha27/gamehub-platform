// backend/src/utils/mailer.js
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT = 587,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = '"GPX" <no-reply@example.com>',
} = process.env;

const port = Number(SMTP_PORT);
const secure = port === 465; // 465=SSL, 587=STARTTLS

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  requireTLS: !secure, // บังคับอัปเกรด TLS เมื่อใช้ 587
  // เปิดดีบักชั่วคราว
  logger: true,
  debug: true,
});

async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
}

module.exports = { sendMail };
