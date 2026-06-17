const https = require("https");
const http = require("http");
const { URL } = require("url");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { createS3Client, getS3Config, hasS3Config } = require("../config/s3");

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

function parseS3Url(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const { bucket, region } = getS3Config();
    if (!bucket) return null;

    const host = parsed.hostname;
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

    if (host === `${bucket}.s3.amazonaws.com` || host === `${bucket}.s3.${region}.amazonaws.com`) {
      return { bucket, key: pathname };
    }

    const pathStylePrefix = `${bucket}/`;
    if ((host === "s3.amazonaws.com" || host === `s3.${region}.amazonaws.com`) && pathname.startsWith(pathStylePrefix)) {
      return { bucket, key: pathname.slice(pathStylePrefix.length) };
    }

    const publicBaseUrl = String(process.env.AWS_S3_PUBLIC_URL || "").trim();
    if (publicBaseUrl && rawUrl.startsWith(publicBaseUrl.replace(/\/+$/, ""))) {
      return { bucket, key: pathname };
    }

    return null;
  } catch {
    return null;
  }
}

function isAllowedUrl(rawUrl, req) {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    if (parseS3Url(rawUrl)) return true;

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
  const s3Object = parseS3Url(rawUrl);
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
