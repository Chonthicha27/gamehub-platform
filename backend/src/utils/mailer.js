// backend/src/utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config(); // โหลดค่าจาก backend/.env

// ===== ENV =====
const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM =
  process.env.MAIL_FROM || '"GPX" <chontichathongkam1@gmail.com>';

// แค่ log ไว้ debug (ไม่โชว์รหัสจริง)
console.log("[MAILER] HOST =", SMTP_HOST, "PORT =", SMTP_PORT);
console.log("[MAILER] SMTP_USER =", SMTP_USER);
console.log("[MAILER] SMTP_PASS length =", SMTP_PASS ? SMTP_PASS.length : 0);

if (!SMTP_USER || !SMTP_PASS) {
  console.error(
    "[MAILER] ❌ Missing SMTP_USER or SMTP_PASS in backend/.env (ส่งเมลไม่ได้แน่นอน)"
  );
}

const secure = SMTP_PORT === 465; // 465 = SSL, ที่เหลือใช้ STARTTLS

// อย่าทับ pass ตรงนี้เด็ดขาด ให้ใช้ SMTP_PASS จาก .env เท่านั้น
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  requireTLS: !secure,
  logger: true,
  debug: true,
});

// เช็กตอน start server
(async () => {
  try {
    console.log("[MAILER] Verifying SMTP connection...");
    await transporter.verify();
    console.log("[MAILER] ✅ SMTP ready (login OK)");
  } catch (err) {
    console.error("[MAILER] ❌ SMTP verify failed:", err.message || err);
  }
})();

async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log("[MAILER] ✅ Mail sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("[MAILER] Send Error:", err);
    return null;
  }
}

module.exports = { sendMail, transporter };
