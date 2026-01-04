// backend/src/utils/mailer.js
require("dotenv").config();
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  BREVO_API_KEY,
} = process.env;

// Render จะมี env RENDER=true อัตโนมัติ
const isRender = !!process.env.RENDER;
const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production" || isRender;

const FROM_EMAIL =
  (MAIL_FROM || SMTP_USER || "").trim() || '"BU Ghub" <no-reply@example.com>';

// ======================
// 1) ส่งผ่าน Brevo HTTP API (ใช้บน Render / prod)
// ======================
async function sendViaBrevoApi({ to, subject, html, text }) {
  if (!BREVO_API_KEY) {
    console.warn("[MAILER] BREVO_API_KEY not set, skip Brevo API");
    return false;
  }
  if (!to || !subject) {
    console.warn("[MAILER] sendViaBrevoApi missing to/subject");
    return false;
  }

  const senderEmail = FROM_EMAIL.match(/<(.*)>/)?.[1] || FROM_EMAIL;
  const senderName =
    FROM_EMAIL.match(/^(.*)</)?.[1]?.trim() || "BU Ghub";

  const body = {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html || undefined,
    textContent: text || undefined,
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(
        "[MAILER] ❌ Brevo API error:",
        res.status,
        res.statusText,
        txt.slice(0, 500)
      );
      return false;
    }

    console.log("[MAILER] ✅ Brevo API email sent to", to);
    return true;
  } catch (err) {
    console.error("[MAILER] ❌ Brevo API request failed:", err.message);
    return false;
  }
}

// ======================
// 2) SMTP สำหรับตอน dev/local
// ======================
let transporter = null;

if (!isProd) {
  const host = SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(SMTP_PORT) || 587;

  console.log(
    `[MAILER] DEV SMTP mode ${host}:${port} user=${SMTP_USER || "-"}`
  );

  if (host && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL, ที่เหลือ STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      requireTLS: port !== 465,
    });

    (async () => {
      try {
        console.log("[MAILER] Verifying SMTP connection (local/dev)...");
        await transporter.verify();
        console.log("[MAILER] ✅ SMTP ready (local/dev)");
      } catch (err) {
        console.error(
          "[MAILER] ❌ SMTP verify failed (local/dev):",
          err.message || err
        );
      }
    })();
  } else {
    console.warn(
      "[MAILER] ⚠ No SMTP config in .env (local); emails will not be sent via SMTP."
    );
  }
} else {
  console.log(
    "[MAILER] PROD/Render: will prefer Brevo HTTP API over SMTP (to avoid SMTP timeouts)."
  );
}

/**
 * ฟังก์ชันหลักที่ route อื่นจะเรียก
 * @param {{ to: string, subject: string, html?: string, text?: string }} opts
 */
async function sendMail(opts) {
  const { to, subject, html, text } = opts || {};
  if (!to || !subject) {
    console.warn("[MAILER] sendMail called without to/subject");
    return;
  }

  // 1) บน Render/prod → ใช้ Brevo HTTP API ก่อน
  if (isProd && BREVO_API_KEY) {
    const ok = await sendViaBrevoApi({ to, subject, html, text });
    if (ok) return;
    // ถ้า API fail → จะพยายาม fallback SMTP ถ้ามี (ด้านล่าง)
  }

  // 2) ถ่ายไป SMTP (ถ้ามี config) — ส่วนใหญ่ใช้ตอน dev/local
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        text,
      });
      console.log(
        "[MAILER] ✅ SMTP email sent:",
        info.messageId || "",
        "to",
        to
      );
    } catch (err) {
      console.error("[MAILER] ❌ SMTP sendMail error:", err.message);
    }
    return;
  }

  // 3) ถ้าไม่มีทั้ง API และ SMTP → log เฉย ๆ
  console.log("========== [MAILER:FAKE-SEND] ==========");
  console.log("To:     ", to);
  console.log("Subject:", subject);
  if (text) console.log("Text:   ", text);
  if (html) console.log("HTML:   ", html.slice(0, 300) + "...");
  console.log("=========================================");
}

module.exports = { sendMail };
