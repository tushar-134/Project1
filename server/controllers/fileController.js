const https = require("https");
const http = require("http");
const { URL } = require("url");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const Client = require("../models/Client");
const Task = require("../models/Task");
const { createS3Client, createS3SignedReadUrl, getS3Config, hasS3Config, parseS3ObjectUrl } = require("../config/s3");

/**
 * GET /api/files/proxy?url=<encodedUrl>&filename=<optionalName>
 *
 * Authenticated server-side file proxy for S3, legacy Cloudinary URLs, and
 * local /uploads/ assets. The browser talks to this API route, and the server
 * fetches the object from storage so document previews avoid browser CORS
 * problems.
 */

const ALLOWED_HOSTS = [
  "res.cloudinary.com",
];

/**
 * Matches any AWS S3 hostname pattern:
 *   - Virtual-hosted: <bucket>.s3.<region>.amazonaws.com  or  <bucket>.s3.amazonaws.com
 *   - Path-style:     s3.<region>.amazonaws.com           or  s3.amazonaws.com
 */
function isS3Host(hostname) {
  return /^(.+\.)?s3(\.[\w-]+)?\.amazonaws\.com$/.test(hostname);
}

function isAllowedUrl(rawUrl, req) {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    if (parseS3ObjectUrl(rawUrl)) return true;

    // Allow any S3 hostname so files are proxied even when S3 env vars
    // are incomplete (falls through to the HTTP proxy path).
    if (isS3Host(parsed.hostname)) return true;

    if (ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return true;
    }

    const ownHost = req.get("host");
    if (ownHost && parsed.hostname === ownHost.split(":")[0]) {
      return parsed.pathname.startsWith("/uploads/");
    }

    return false;
  } catch {
    return false;
  }
}

function guessMimeFromUrl(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    if (pathname.endsWith(".pdf")) return "application/pdf";
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".doc")) return "application/msword";
    if (pathname.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (pathname.endsWith(".xls")) return "application/vnd.ms-excel";
    if (pathname.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } catch { /* ignore */ }
  return "application/octet-stream";
}

function setFileHeaders(res, { contentType, contentLength, filename, isPdf }) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `${isPdf ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`);
  if (contentLength) res.setHeader("Content-Length", String(contentLength));
  res.setHeader("Cache-Control", "private, max-age=600");
}

async function proxyS3File(rawUrl, filename, res) {
  const s3Object = parseS3ObjectUrl(rawUrl);
  if (!s3Object || !hasS3Config()) return false;

  const s3Res = await createS3Client().send(new GetObjectCommand({
    Bucket: s3Object.bucket,
    Key: s3Object.key,
  }));

  const contentType = s3Res.ContentType || guessMimeFromUrl(rawUrl);
  const safeName = filename || s3Object.key.split("/").pop() || "document";
  const isPdf = contentType.includes("pdf") || safeName.toLowerCase().endsWith(".pdf");

  setFileHeaders(res, {
    contentType,
    contentLength: s3Res.ContentLength,
    filename: safeName,
    isPdf,
  });

  res.status(200);
  s3Res.Body.pipe(res, { end: true });
  return true;
}

function buildFileLookupQuery({ key, url }) {
  const clauses = [];
  const keyFields = [
    "attachments.key",
    "tradeLicences.documents.key",
    "contactPersons.emiratesId.documents.key",
    "contactPersons.emiratesId.frontDocuments.key",
    "contactPersons.emiratesId.backDocuments.key",
    "contactPersons.passport.documents.key",
  ];
  const urlFields = [
    "attachments.url",
    "tradeLicences.documents.url",
    "contactPersons.emiratesId.documents.url",
    "contactPersons.emiratesId.frontDocuments.url",
    "contactPersons.emiratesId.backDocuments.url",
    "contactPersons.passport.documents.url",
  ];
  if (key) keyFields.forEach((field) => clauses.push({ [field]: key }));
  if (url) urlFields.forEach((field) => clauses.push({ [field]: url }));
  return clauses.length ? { $or: clauses } : null;
}

async function userCanAccessStoredFile(req, { key, url }) {
  const taskClauses = [];
  if (key) taskClauses.push({ "attachments.key": key });
  if (url) taskClauses.push({ "attachments.url": url });

  if (taskClauses.length) {
    const taskQuery = { $or: taskClauses };
    if (req.user.role === "associate") taskQuery.assignedTo = req.user._id;
    const task = await Task.findOne(taskQuery).select("_id");
    if (task) return true;
  }

  const clientFileQuery = buildFileLookupQuery({ key, url });
  if (!clientFileQuery) return false;

  if (req.user.role === "associate") {
    const assignedClientIds = await Task.distinct("client", { assignedTo: req.user._id });
    clientFileQuery._id = { $in: assignedClientIds };
  }

  const client = await Client.findOne(clientFileQuery).select("_id");
  return Boolean(client);
}

exports.createSignedUrl = async (req, res, next) => {
  try {
    const requestedKey = String(req.query.key || "").trim().replace(/^\/+/, "");
    const requestedUrl = String(req.query.url || "").trim();
    const parsed = requestedKey
      ? { bucket: getS3Config().bucket, key: requestedKey }
      : parseS3ObjectUrl(requestedUrl);

    if (!parsed?.key || parsed.bucket !== getS3Config().bucket) {
      return res.status(400).json({ message: "A valid S3 file key or URL is required" });
    }

    const { uploadPrefix } = getS3Config();
    if (uploadPrefix && !parsed.key.startsWith(`${uploadPrefix}/`)) {
      return res.status(400).json({ message: "Invalid file key" });
    }

    const canAccess = await userCanAccessStoredFile(req, { key: parsed.key, url: requestedUrl });
    if (!canAccess) return res.status(404).json({ message: "File not found" });

    const expiresIn = Math.max(60, Math.min(900, Number(req.query.expiresIn) || 300));
    const url = await createS3SignedReadUrl({
      bucket: parsed.bucket,
      key: parsed.key,
      filename: req.query.filename,
      contentType: req.query.contentType,
      expiresIn,
    });

    res.json({ url, expiresIn, key: parsed.key });
  } catch (error) {
    next(error);
  }
};

function proxyHttpFile(rawUrl, filename, res) {
  const protocol = rawUrl.startsWith("http://") ? http : https;

  const proxyReq = protocol.get(rawUrl, { timeout: 30_000 }, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || guessMimeFromUrl(rawUrl);
    const safeName = filename || rawUrl.split("/").pop()?.split("?")[0] || "document";
    const isPdf = contentType.includes("pdf") || safeName.toLowerCase().endsWith(".pdf");

    setFileHeaders(res, {
      contentType,
      contentLength: proxyRes.headers["content-length"],
      filename: safeName,
      isPdf,
    });

    res.status(200);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).json({ message: "Upstream file fetch timed out" });
  });

  proxyReq.on("error", (err) => {
    console.error("[fileProxy] upstream error:", err.message);
    if (!res.headersSent) res.status(502).json({ message: "Failed to fetch file from storage" });
  });
}

exports.proxyFile = (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  const filename = String(req.query.filename || "").trim() || "";

  if (!rawUrl) {
    return res.status(400).json({ message: "Missing required query param: url" });
  }

  if (!isAllowedUrl(rawUrl, req)) {
    return res.status(403).json({ message: "Proxying this URL is not permitted" });
  }

  proxyS3File(rawUrl, filename, res)
    .then((handled) => {
      if (!handled) proxyHttpFile(rawUrl, filename, res);
    })
    .catch((err) => {
      console.error("[fileProxy] S3 error:", err.message);
      if (!res.headersSent) res.status(502).json({ message: "Failed to fetch file from S3" });
    });
};
