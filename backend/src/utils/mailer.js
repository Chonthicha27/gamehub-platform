// backend/src/utils/mailer.js
const axios = require("axios");

const {
  EMAIL_ENABLED = "false",
  MAIL_FROM = '"GPX" <no-reply@example.com>',
  EMAIL_API_KEY, // API key จาก Brevo (หรือ provider อื่นที่ใช้)
} = process.env;

const emailEnabled = String(EMAIL_ENABLED).toLowerCase() === "true";

/**
 * ส่งอีเมลผ่าน HTTP API (Brevo)
 * ถ้าไม่ได้เปิด EMAIL_ENABLED หรือไม่มี API key → จะไม่ส่งจริง แค่ log
 */
async function sendMail({ to, subject, html, text }) {
  if (!emailEnabled) {
    console.log("[mail] Skip send: EMAIL_ENABLED = false", { to, subject });
    return { skipped: true, reason: "EMAIL_ENABLED=false" };
  }

  if (!EMAIL_API_KEY) {
    console.warn("[mail] Skip send: missing EMAIL_API_KEY", { to, subject });
    return { skipped: true, reason: "Missing EMAIL_API_KEY" };
  }

  // ดึง email จริงออกจาก MAIL_FROM ("Name" <email@xxx>)
  const emailMatch = MAIL_FROM.match(/<(.*)>/);
  const senderEmail = emailMatch ? emailMatch[1] : MAIL_FROM;

  // ชื่อที่จะแสดงในเมล
  const nameMatch = MAIL_FROM.match(/"([^"]+)"/);
  const senderName = nameMatch ? nameMatch[1] : "GPX";

  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: senderEmail,
          name: senderName,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          "api-key": EMAIL_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("[mail] Email sent via API to:", to);
    return res.data;
  } catch (err) {
    console.error(
      "[mail] API send error:",
      err.response?.data || err.message
    );
    return { error: err.message, data: err.response?.data };
  }
}

module.exports = { sendMail };
