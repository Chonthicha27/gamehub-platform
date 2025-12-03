// backend/src/utils/firebaseStorageClient.js
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

let bucket = null;

function initBucket() {
  if (bucket) return bucket;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

  if (!json || !bucketName) {
    console.warn(
      "[Firebase] FIREBASE_SERVICE_ACCOUNT หรือ FIREBASE_STORAGE_BUCKET ยังไม่ตั้งค่า"
    );
    return null;
  }

  let serviceAccount;// backend/src/utils/firebaseStorageClient.js
const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");

let bucket = null;

function initFirebase() {
  if (bucket) return bucket;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "";

  if (!serviceAccountJson || !bucketName) {
    console.warn("[firebaseStorage] env not set, Firebase disabled");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: bucketName,
      });
    }

    bucket = admin.storage().bucket(bucketName);
    console.log("[firebaseStorage] Connected bucket:", bucketName);
    return bucket;
  } catch (err) {
    console.error("[firebaseStorage] init error:", err.message || err);
    return null;
  }
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html";
    case ".zip":
      return "application/zip";
    case ".js":
      return "text/javascript";
    case ".css":
      return "text/css";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * อัปโหลดไฟล์จาก local path -> Firebase Storage
 * แล้วทำไฟล์ให้ public และคืน public URL
 */
async function uploadLocalFileToFirebase(localPath, destPath) {
  const b = initFirebase();
  if (!b) throw new Error("Firebase Storage not configured");

  const contentType = guessContentType(localPath);

  const [file] = await b.upload(localPath, {
    destination: destPath,
    gzip: false,
    metadata: {
      contentType,
      cacheControl: "public,max-age=31536000",
    },
  });

  // ลบไฟล์ temp ที่เซิร์ฟเวอร์ทิ้ง
  await fs.unlink(localPath).catch(() => {});

  // ทำไฟล์ให้ public
  await file.makePublic();

  // public URL แบบตรง ๆ จาก GCS
  return `https://storage.googleapis.com/${b.name}/${destPath}`;
}

module.exports = {
  uploadLocalFileToFirebase,
};

  try {
    serviceAccount = JSON.parse(json);
  } catch (e) {
    console.error("[Firebase] parse FIREBASE_SERVICE_ACCOUNT ไม่ได้:", e.message);
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName,
    });
  }

  bucket = getStorage().bucket(bucketName);
  console.log("[Firebase] Storage bucket ready:", bucketName);
  return bucket;
}

/**
 * อัปโหลดไฟล์จากดิสก์ขึ้น Firebase Storage แล้วคืน public URL
 * @param {string} localPath - path บนเซิร์ฟเวอร์
 * @param {string} destPath - path ใน bucket เช่น "games/gameId/index.html"
 * @param {string} contentType - MIME type
 */
async function uploadLocalFile(localPath, destPath, contentType) {
  const b = initBucket();
  if (!b) throw new Error("Firebase Storage not initialized");

  const options = {
    destination: destPath,
    metadata: {},
  };
  if (contentType) {
    options.metadata.contentType = contentType;
  }

  await b.upload(localPath, options);

  // ทำไฟล์ให้ public
  await b.file(destPath).makePublic();

  // public URL แบบง่าย
  return `https://storage.googleapis.com/${b.name}/${encodeURI(destPath)}`;
}

/**
 * ลบไฟล์ทั้งหมดที่ขึ้นต้นด้วย prefix
 * เช่น prefix = "games/slug-xxx/"
 */
async function deletePrefix(prefix) {
  const b = initBucket();
  if (!b) return;
  await b.deleteFiles({ prefix });
}

module.exports = {
  uploadLocalFile,
  deletePrefix,
};
