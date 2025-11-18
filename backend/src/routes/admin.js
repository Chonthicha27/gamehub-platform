// backend/src/routes/admin.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const fsp = fs.promises;
const { authRequired, requireAdmin } = require("../middleware/auth");
const User = require("../models/User");
const Game = require("../models/Game");
const Comment = require("../models/Comment");
const { sendMail } = require("../utils/mailer");

router.use(authRequired, requireAdmin);

/* ===== Users ===== */
router.get("/users", async (_req, res) => {
  const users = await User.find()
    .select("-passwordHash -__v")
    .sort("-createdAt")
    .lean();
  res.json(users);
});

// เปลี่ยน role / เปลี่ยนสถานะ
router.patch("/users/:id", async (req, res) => {
  const { role, status, reason, days } = req.body || {};

  if (role) {
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "invalid role" });
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  if (status === "suspended") {
    const until = new Date(Date.now() + Number(days || 7) * 86400000);
    const u = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: "suspended",
        suspendedReason: reason || "violation",
        suspendedUntil: until,
      },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  if (status === "active") {
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", suspendedReason: "", suspendedUntil: null },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  return res.status(400).json({ message: "no changes" });
});

router.delete("/users/:id", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found" });

  const games = await Game.find({ uploader: u._id });
  for (const g of games) {
    const parts = (g.fileUrl || g.coverUrl || "").split("/");
    const gameId = parts.length >= 4 ? parts[3] : null;
    if (gameId) {
      const dir = path.join(__dirname, "../../uploads/games", gameId);
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
  await Game.deleteMany({ uploader: u._id });
  await u.deleteOne();
  res.json({ ok: true });
});

/* ===== Games ===== */

// เกมที่รออนุมัติ
router.get("/games/pending", async (_req, res) => {
  const games = await Game.find({ visibility: "review" })
    .sort("-createdAt")
    .populate("uploader", "username email")
    .lean();
  res.json(games);
});

// ✅ อนุมัติเกม (review -> public) + ส่งเมลแจ้ง
router.patch("/games/:id/approve", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id).populate(
      "uploader",
      "username email"
    );
    if (!game) return res.status(404).json({ message: "Not found" });

    game.visibility = "public";
    game.suspendedReason = "";
    game.suspendedAt = null;
    await game.save();

    const email = game.uploader?.email;
    if (email) {
      const subject = `เกมของคุณ "${game.title}" ผ่านการอนุมัติแล้ว 🎮`;
      const text = [
        `สวัสดี ${game.uploader.username || ""}`,
        "",
        `เกมของคุณ "${game.title}" ได้ผ่านการตรวจและถูกเผยแพร่บน GPX เรียบร้อยแล้ว`,
        "",
        "ขอบคุณที่แชร์ผลงานเกมของคุณให้ผู้เล่นคนอื่น ๆ ได้ลองเล่นกันนะครับ/ค่ะ ❤️",
        "",
        "– ทีมงาน GameHub",
      ].join("\n");

      const html = `
        <p>สวัสดี <strong>${game.uploader.username || ""}</strong></p>
        <p>เกมของคุณ <strong>"${game.title}"</strong> ได้<strong>ผ่านการอนุมัติ</strong> และเผยแพร่บน <strong>GameHub</strong> เรียบร้อยแล้ว 🎉</p>
        <p>ขอบคุณที่แชร์ผลงานเกมของคุณให้ผู้เล่นคนอื่น ๆ ได้ลองเล่นกันนะครับ/ค่ะ ❤️</p>
        <p>– ทีมงาน GameHub</p>
      `;

      try {
        await sendMail({ to: email, subject, text, html });
      } catch (err) {
        console.error("[admin] send approve mail failed:", err.message);
      }
    }

    res.json({ message: "Game approved", game });
  } catch (err) {
    console.error("[admin] approve error:", err);
    res.status(500).json({ message: "approve failed" });
  }
});

// รายการเกมทั้งหมด (admin เห็นทุกสถานะ)
router.get("/games", async (_req, res) => {
  const games = await Game.find()
    .sort("-createdAt")
    .populate("uploader", "username email")
    .lean();
  res.json(games);
});

/**
 * ระงับเกม (public -> suspended)
 */
router.patch("/games/:id/suspend", async (req, res) => {
  console.log(
    "[admin] PATCH /admin/games/:id/suspend",
    req.params.id,
    "reason =",
    req.body?.reason
  );

  try {
    const { reason = "" } = req.body || {};

    const game = await Game.findById(req.params.id).populate(
      "uploader",
      "username email"
    );
    if (!game) return res.status(404).json({ message: "Not found" });

    game.visibility = "suspended";
    game.suspendedReason = reason;
    game.suspendedAt = new Date();
    await game.save();

    const email = game.uploader?.email || "";
    const uploaderName = game.uploader?.username || "";
    const title = game.title;

    res.json({ message: "Game suspended", game });

    if (email) {
      (async () => {
        try {
          const subject = `เกมของคุณ "${title}" ถูกระงับการแสดงผลชั่วคราว`;

          const textLines = [
            `สวัสดี ${uploaderName}`,
            "",
            `ขอแจ้งให้ทราบว่าเกมของคุณ "${title}" ถูกระงับการแสดงผลชั่วคราวเนื่องจากละเมิดนโยบายของแพลตฟอร์ม`,
            reason ? `เหตุผล: ${reason}` : "",
            "",
            "คุณสามารถแก้ไขเนื้อหาเกมให้สอดคล้องกับนโยบาย แล้วอัปโหลดใหม่ได้ทุกเมื่อครับ/ค่ะ",
            "",
            "– ทีมงาน GameHub",
          ];

          const html = `
            <p>สวัสดี <strong>${uploaderName}</strong></p>
            <p>ขอแจ้งให้ทราบว่าเกมของคุณ <strong>"${title}"</strong> ถูก<strong>ระงับการแสดงผลชั่วคราว</strong> เนื่องจากละเมิดนโยบายของแพลตฟอร์ม</p>
            ${
              reason
                ? `<p><strong>เหตุผล:</strong> ${reason}</p>`
                : ""
            }
            <p>คุณสามารถแก้ไขเนื้อหาเกมให้สอดคล้องกับนโยบาย แล้วอัปโหลดใหม่ได้ทุกเมื่อครับ/ค่ะ</p>
            <p>– ทีมงาน GameHub</p>
          `;

          await sendMail({
            to: email,
            subject,
            text: textLines.join("\n"),
            html,
          });
          console.log("[admin] suspend mail sent to", email);
        } catch (err) {
          console.error("[admin] send suspend mail failed:", err.message);
        }
      })();
    }
  } catch (err) {
    console.error("[admin] suspend game error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Suspend failed" });
    }
  }
});

/**
 * ปลดระงับเกม (suspended -> public)
 */
router.patch("/games/:id/unsuspend", async (req, res) => {
  console.log("[admin] PATCH /admin/games/:id/unsuspend", req.params.id);

  try {
    const game = await Game.findById(req.params.id).populate(
      "uploader",
      "username email"
    );
    if (!game) return res.status(404).json({ message: "Not found" });

    game.visibility = "public";
    game.suspendedReason = "";
    game.suspendedAt = null;
    await game.save();

    const email = game.uploader?.email || "";
    const uploaderName = game.uploader?.username || "";
    const title = game.title;

    res.json({ message: "Game unsuspended", game });

    if (email) {
      (async () => {
        try {
          const subject = `เกมของคุณ "${title}" ถูกปลดระงับแล้ว`;

          const textLines = [
            `สวัสดี ${uploaderName}`,
            "",
            `เกมของคุณ "${title}" ถูกปลดระงับและกลับมาแสดงผลบน GPX อีกครั้งแล้ว`,
            "",
            "– ทีมงาน GameHub",
          ];

          const html = `
            <p>สวัสดี <strong>${uploaderName}</strong></p>
            <p>เกมของคุณ <strong>"${title}"</strong> ถูก<strong>ปลดระงับ</strong> และกลับมาแสดงผลบน <strong>GameHub</strong> อีกครั้งแล้ว 🎉</p>
            <p>– ทีมงาน GameHub</p>
          `;

          await sendMail({
            to: email,
            subject,
            text: textLines.join("\n"),
            html,
          });
          console.log("[admin] unsuspend mail sent to", email);
        } catch (err) {
          console.error("[admin] send unsuspend mail failed:", err.message);
        }
      })();
    }
  } catch (err) {
    console.error("[admin] unsuspend game error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Unsuspend failed" });
    }
  }
});

/**
 * DELETE /admin/games/:id
 * - ถ้าเป็นเกมที่กำลัง review และมี query ?reason=... → ถือว่า "ไม่อนุมัติ" และแนบเหตุผลไปในอีเมล
 * - ถ้าไม่มี reason → ลบเฉย ๆ (แต่ยังส่งอีเมลแจ้งว่าถูกนำออกจากระบบ)
 */
router.delete("/games/:id", async (req, res) => {
  console.log(
    "[admin] DELETE /admin/games/:id",
    req.params.id,
    "reason =",
    req.query.reason
  );

  try {
    const reason =
      typeof req.query.reason === "string" ? req.query.reason : "";

    const game = await Game.findById(req.params.id).populate(
      "uploader",
      "username email"
    );
    if (!game) return res.status(404).json({ message: "Not found" });

    const wasPending = game.visibility === "review";
    const email = game.uploader?.email || "";
    const uploaderName = game.uploader?.username || "";
    const title = game.title;

    await game.deleteOne();
    res.json({ ok: true });

    if (email) {
      (async () => {
        try {
          const subject = wasPending
            ? `เกมของคุณ "${title}" ไม่ผ่านการอนุมัติ`
            : `เกมของคุณ "${title}" ถูกนำออกจากระบบ`;

          const extraReasonText =
            wasPending && reason ? `เหตุผล: ${reason}\n` : "";
          const extraReasonHtml =
            wasPending && reason
              ? `<p><strong>เหตุผล:</strong> ${reason}</p>`
              : "";

          const textLines = wasPending
            ? [
                `สวัสดี ${uploaderName}`,
                "",
                `ขอแจ้งให้ทราบว่าเกมของคุณ "${title}" ไม่ผ่านการอนุมัติจากทีมตรวจสอบเนื้อหา และถูกนำออกจากระบบแล้ว`,
                extraReasonText,
                "หากต้องการปรับปรุงเกมและอัปโหลดใหม่ สามารถทำได้ทุกเมื่อครับ/ค่ะ",
                "",
                "– ทีมงาน GameHub",
              ]
            : [
                `สวัสดี ${uploaderName}`,
                "",
                `ขอแจ้งให้ทราบว่าเกมของคุณ "${title}" ถูกนำออกจากระบบเรียบร้อยแล้ว`,
                "",
                "– ทีมงาน GameHub",
              ];

          const html = wasPending
            ? `
              <p>สวัสดี <strong>${uploaderName}</strong></p>
              <p>ขอแจ้งให้ทราบว่าเกมของคุณ <strong>"${title}"</strong> <strong>ไม่ผ่านการอนุมัติ</strong> จากทีมตรวจสอบเนื้อหา และถูกนำออกจากระบบแล้ว</p>
              ${extraReasonHtml}
              <p>หากต้องการปรับปรุงเกมและอัปโหลดใหม่ สามารถทำได้ทุกเมื่อครับ/ค่ะ</p>
              <p>– ทีมงาน GameHub</p>
            `
            : `
              <p>สวัสดี <strong>${uploaderName}</strong></p>
              <p>ขอแจ้งให้ทราบว่าเกมของคุณ <strong>"${title}"</strong> ถูกนำออกจากระบบเรียบร้อยแล้ว</p>
              <p>– ทีมงาน GameHub</p>
            `;

          await sendMail({
            to: email,
            subject,
            text: textLines.join("\n"),
            html,
          });
          console.log("[admin] delete mail sent to", email);
        } catch (err) {
          console.error("[admin] send delete mail failed:", err.message);
        }
      })();
    }
  } catch (err) {
    console.error("[admin] delete game error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Delete failed" });
    }
  }
});

/* ===== Comments (Moderation) ===== */

/**
 * GET /admin/comments?status=visible|hidden|deleted (optional)
 * ดึง list คอมเมนต์ + ข้อมูลเกม + คนเขียน
 */
router.get("/comments", async (req, res) => {
  const { status } = req.query;

  const filter = {};
  if (status && ["visible", "hidden", "deleted"].includes(status)) {
    filter.status = status;
  }

  const comments = await Comment.find(filter)
    .sort("-createdAt")
    .populate("author", "username email")
    .populate("game", "title slug")
    .lean();

  res.json(comments);
});

/**
 * ซ่อนคอมเมนต์ (ละเมิดนโยบาย)
 * PATCH /admin/comments/:id/hide { reason }
 */
router.patch("/comments/:id/hide", async (req, res) => {
  const { reason = "" } = req.body || {};
  const adminId = req.user?._id;

  const c = await Comment.findById(req.params.id)
    .populate("author", "username email")
    .populate("game", "title");
  if (!c) return res.status(404).json({ message: "Not found" });

  c.status = "hidden";
  c.moderationReason = reason;
  c.moderatedBy = adminId || null;
  c.moderatedAt = new Date();
  await c.save();

  // (optional) สามารถเพิ่ม logic ส่งอีเมลแจ้งผู้เขียนได้ภายหลัง
  res.json(c);
});

/**
 * คืนคอมเมนต์ (ให้กลับมา visible)
 * PATCH /admin/comments/:id/restore
 */
router.patch("/comments/:id/restore", async (req, res) => {
  const adminId = req.user?._id;

  const c = await Comment.findById(req.params.id)
    .populate("author", "username email")
    .populate("game", "title");
  if (!c) return res.status(404).json({ message: "Not found" });

  c.status = "visible";
  c.moderatedBy = adminId || null;
  c.moderatedAt = new Date();
  await c.save();

  res.json(c);
});

/**
 * ลบคอมเมนต์ถาวร
 * DELETE /admin/comments/:id
 */
router.delete("/comments/:id", async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });

  await c.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
