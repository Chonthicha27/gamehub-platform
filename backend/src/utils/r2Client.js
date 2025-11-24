// backend/src/utils/r2Client.js
const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
require("dotenv").config();

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.warn("[R2] Missing config in .env - uploads to R2 will NOT work");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// base URL สำหรับ public read (จะใช้ทั้ง uploadBuffer / uploadLocalFile)
function getPublicBaseUrl() {
  const base =
    R2_PUBLIC_BASE_URL ||
    `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return base.replace(/\/$/, "");
}

/**
 * อัปโหลด buffer ขึ้น R2 แล้วคืนค่า public URL กลับมา
 * @param {string} key - path ใน bucket เช่น "games/1234/build/index.html"
 * @param {Buffer} body
 * @param {string} contentType - MIME type เช่น "application/zip"
 */
async function uploadBuffer(key, body, contentType = "application/octet-stream") {
  if (!R2_BUCKET) throw new Error("R2_BUCKET not set");

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const base = getPublicBaseUrl();
  return `${base}/${encodeURI(key)}`;
}

/**
 * อัปโหลดไฟล์จากดิสก์ขึ้น R2 (ใช้โดย games.js)
 * @param {string} localPath - path บนเครื่องเซิร์ฟเวอร์ เช่น "/tmp/xxx.zip"
 * @param {string} key - key ใน bucket เช่น "games/slug-123/index.html"
 * @param {string} contentType - MIME type (ถ้าไม่ส่งจะเดาแบบง่าย ๆ ให้)
 */
async function uploadLocalFile(localPath, key, contentType) {
  if (!contentType) {
    const ext = path.extname(localPath).toLowerCase();
    if (ext === ".html") contentType = "text/html";
    else if (ext === ".zip") contentType = "application/zip";
    else if (ext === ".js") contentType = "text/javascript";
    else if (ext === ".css") contentType = "text/css";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else contentType = "application/octet-stream";
  }

  const buf = await fs.promises.readFile(localPath);
  const url = await uploadBuffer(key, buf, contentType);
  return url;
}

/**
 * ลบ object เดียวใน R2
 * @param {string} key
 */
async function deleteObject(key) {
  if (!R2_BUCKET) return;
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

/**
 * ลบไฟล์ทั้งหมดที่ขึ้นต้นด้วย prefix ที่กำหนด
 * ใช้ตอนลบเกมทั้งเกม (เช่น "games/slug-123/")
 * @param {string} prefix
 */
async function deletePrefix(prefix) {
  if (!R2_BUCKET) return;

  let token = undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );

    const contents = resp.Contents || [];
    if (contents.length > 0) {
      // ลบทีละไฟล์ (จำนวนไม่เยอะสำหรับโปรเจกต์นี้ ใช้แบบง่าย ๆ ก่อน)
      for (const obj of contents) {
        if (obj.Key) {
          await deleteObject(obj.Key);
        }
      }
    }

    token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (token);
}

module.exports = {
  uploadBuffer,
  deleteObject,
  uploadLocalFile, // <<< games.js เรียกใช้ตัวนี้
  deletePrefix,    // <<< games.js เรียกใช้ตัวนี้
};
