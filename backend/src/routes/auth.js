// backend/src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const crypto = require("crypto");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";

// เปิด/ปิดระบบอีเมล จาก ENV
const EMAIL_ENABLED =
  String(process.env.EMAIL_ENABLED || "false").toLowerCase() === "true";

// login status (จาก session)
router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    avatar: req.user.avatar || "",
    emailVerified: !!req.user.emailVerified,
  });
});

router.get("/logout", (req, res) => {
  req.logout(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ----- helper: ส่งอีเมลยืนยัน -----
async function sendVerifyEmail(user) {
  const token = crypto.randomBytes(32).toString("hex");
  user.emailVerifyToken = token;
  user.emailVerifyExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 ชม.
  await user.save();

  const link = `${SERVER_URL}/api/auth/verify-email?uid=${user._id}&token=${token}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
      <h2>ยืนยันอีเมลสำหรับ GPX</h2>
      <p>สวัสดี ${user.username}, กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
      <p><a href="${link}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">ยืนยันอีเมล</a></p>
      <p>หรือเปิดลิงก์นี้: <a href="${link}">${link}</a></p>
      <p style="color:#666">ลิงก์จะหมดอายุใน 24 ชั่วโมง</p>
    </div>
  `;

  await sendMail({
    to: user.email,
    subject: "GPX - ยืนยันอีเมลของคุณ",
    html,
    text: `Verify: ${link}`,
  });
}

// ----- สมัครสมาชิก (ส่งลิงก์ยืนยัน ถ้าเปิดอีเมล) -----
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ message: "กรอกข้อมูลให้ครบ" });
    if (password.length < 6)
      return res.status(400).json({ message: "รหัสผ่านอย่างน้อย 6 ตัว" });

    if (await User.findOne({ username }))
      return res.status(409).json({ message: "ชื่อผู้ใช้ถูกใช้แล้ว" });
    if (await User.findOne({ email }))
      return res.status(409).json({ message: "อีเมลถูกใช้แล้ว" });

    const passwordHash = await bcrypt.hash(password, 10);

    // ถ้าไม่ใช้ระบบอีเมล ให้ถือว่า verified ตั้งแต่แรก
    const user = await User.create({
      username,
      email,
      passwordHash,
      emailVerified: !EMAIL_ENABLED,
    });

    if (EMAIL_ENABLED) {
      try {
        await sendVerifyEmail(user);
        return res.json({
          ok: true,
          message:
            "ส่งลิงก์ยืนยันอีเมลแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ",
        });
      } catch (e) {
        console.error("[auth/register] sendVerifyEmail error:", e);
        // สมัครได้ แต่ส่งอีเมลล้มเหลว
        return res.json({
          ok: true,
          message:
            "สมัครสำเร็จ แต่ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลอง 'ส่งลิงก์อีกครั้ง' ภายหลัง",
        });
      }
    } else {
      // โหมดไม่ใช้เมล
      return res.json({
        ok: true,
        message: "สมัครสำเร็จ คุณสามารถล็อกอินได้ทันที",
      });
    }
  } catch (e) {
    next(e);
  }
});

// ----- Verify email จากลิงก์ -----
router.get("/verify-email", async (req, res) => {
  const { uid, token } = req.query || {};
  const user = await User.findById(uid);
  if (!user) return res.status(400).send("Invalid link");
  if (!user.emailVerifyToken || user.emailVerifyToken !== token)
    return res.status(400).send("Invalid or used token");
  if (
    !user.emailVerifyExpires ||
    user.emailVerifyExpires.getTime() < Date.now()
  )
    return res.status(400).send("Token expired");

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();

  return res.redirect(`${CLIENT_URL}?verified=1`);
});

// ----- Resend verify -----
router.post("/resend-verify", async (req, res) => {
  if (!EMAIL_ENABLED) {
    return res.json({
      ok: false,
      message: "ระบบอีเมลถูกปิดอยู่ ไม่สามารถส่งลิงก์ยืนยันได้",
    });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "ต้องระบุอีเมล" });
  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ message: "ไม่พบบัญชีอีเมลนี้" });
  if (user.emailVerified)
    return res.json({ ok: true, message: "อีเมลนี้ยืนยันแล้ว" });

  await sendVerifyEmail(user);
  res.json({ ok: true, message: "ส่งอีเมลยืนยันอีกครั้งแล้ว" });
});

// ----- ลืมรหัสผ่าน: ขอส่งลิงก์ reset -----
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "ต้องระบุอีเมล" });

    const user = await User.findOne({ email });

    // ถ้าไม่มี user ก็ยังตอบเหมือนเดิมเพื่อความปลอดภัย
    if (!user || !user.email) {
      return res.json({
        ok: true,
        message:
          "ถ้าอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว",
      });
    }

    if (!EMAIL_ENABLED) {
      // ไม่มีระบบอีเมล → บอกผู้ใช้ตรง ๆ
      return res.json({
        ok: false,
        message: "ขณะนี้ระบบอีเมลถูกปิดอยู่ ไม่สามารถรีเซ็ตรหัสผ่านผ่านอีเมลได้",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 ชม.
    await user.save();

    const link = `${CLIENT_URL}/reset-password?token=${token}`;

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
        <h2>รีเซ็ตรหัสผ่าน GPX</h2>
        <p>คุณได้รับอีเมลนี้เพราะมีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี GPX ของคุณ</p>
        <p><a href="${link}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">ตั้งรหัสผ่านใหม่</a></p>
        <p>หรือเปิดลิงก์นี้: <a href="${link}">${link}</a></p>
        <p style="color:#666;font-size:12px">ลิงก์จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้เป็นคนขอ สามารถเพิกเฉยอีเมลนี้ได้</p>
      </div>
    `;

    await sendMail({
      to: user.email,
      subject: "GPX - รีเซ็ตรหัสผ่านของคุณ",
      html,
      text: `Reset password: ${link}`,
    });

    return res.json({
      ok: true,
      message:
        "ถ้าอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว",
    });
  } catch (e) {
    next(e);
  }
});

// ----- ตั้งรหัสผ่านใหม่จาก token -----
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password)
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    if (password.length < 6)
      return res.status(400).json({ message: "รหัสผ่านอย่างน้อย 6 ตัว" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({
      ok: true,
      message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว",
    });
  } catch (e) {
    next(e);
  }
});

// ----- ล็อกอิน -----
// ถ้า EMAIL_ENABLED=false จะไม่บล็อกคนที่ emailVerified=false
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "กรอกอีเมลและรหัสผ่าน" });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(400).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  if (!user.passwordHash)
    return res.status(400).json({
      message:
        "บัญชีนี้สร้างด้วย OAuth โปรดล็อกอินด้วยปุ่ม Google/GitHub",
    });

  if (EMAIL_ENABLED && !user.emailVerified) {
    return res.status(403).json({
      message:
        "ยังไม่ได้ยืนยันอีเมล โปรดตรวจสอบอีเมลหรือกดส่งลิงก์อีกครั้ง",
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)
    return res.status(400).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

  req.login(user, (err) => {
    if (err)
      return res.status(500).json({ message: "สร้าง session ไม่สำเร็จ" });
    res.json({ id: user._id, username: user.username, email: user.email });
  });
});

// ---------- GitHub OAuth ----------
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/?auth=failed" }),
  (_req, res) => res.redirect(CLIENT_URL)
);

// ---------- Google OAuth ----------
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/?auth=failed" }),
  (_req, res) => res.redirect(CLIENT_URL)
);

module.exports = router;
