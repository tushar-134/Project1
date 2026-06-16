const https = require("https");
const http = require("http");
const { URL } = require("url");

/**
 * GET /api/files/proxy?url=<encodedUrl>&filename=<optionalName>
 *
 * Server-side file proxy for Cloudinary (and /uploads/) assets.
 *
 * ROOT CAUSE this fixes:
 *   Browser → Cloudinary direct requests are blocked by CORS because Cloudinary's
 *   CDN does not return Access-Control-Allow-Origin headers for /image/upload/
 *   assets by default. Chrome's PDF renderer also makes a secondary cross-origin
 *   fetch that fails without a Referer header (stripped by noopener,noreferrer).
 *
 * FIX:
 *   Browser → Our API (CORS OK, authenticated) → Cloudinary (server-to-server,
 *   no CORS restriction) → pipes bytes back to browser with correct headers.
 *   The browser sees the file as coming from our own trusted domain.
 *
 * Security:
 *   - Route is protected by auth middleware (JWT required).
 *   - Only proxies http/https URLs (no file:// or data: URIs).
 *   - Only proxies to allowed domains (Cloudinary CDN + own server /uploads/).
 *   - Enforces a 30-second timeout.
 *   - Streams bytes — never buffers the full file in memory.
 */

const ALLOWED_HOSTS = [
  "res.cloudinary.com",
];

function isAllowedUrl(rawUrl, req) {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    // Always allow Cloudinary CDN
    if (ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return true;
    }

    // Allow own server /uploads/ paths
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

exports.proxyFile = (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  const filename = String(req.query.filename || "").trim() || "";

  if (!rawUrl) {
    return res.status(400).json({ message: "Missing required query param: url" });
  }

  if (!isAllowedUrl(rawUrl, req)) {
    return res.status(403).json({ message: "Proxying this URL is not permitted" });
  }

  const protocol = rawUrl.startsWith("http://") ? http : https;

  const proxyReq = protocol.get(rawUrl, { timeout: 30_000 }, (proxyRes) => {
    // Forward Content-Type from Cloudinary, or guess from extension
    const contentType = proxyRes.headers["content-type"] || guessMimeFromUrl(rawUrl);
    res.setHeader("Content-Type", contentType);

    // Set filename for download/display
    const safeName = filename || rawUrl.split("/").pop()?.split("?")[0] || "document";
    // Use inline for PDFs so Chrome opens the viewer; attachment for everything else
    const isPdf = contentType.includes("pdf") || safeName.toLowerCase().endsWith(".pdf");
    res.setHeader(
      "Content-Disposition",
      `${isPdf ? "inline" : "attachment"}; filename="${safeName.replace(/"/g, "")}"`,
    );

    // Forward content-length if present so browser can show progress
    if (proxyRes.headers["content-length"]) {
      res.setHeader("Content-Length", proxyRes.headers["content-length"]);
    }

    // Cache for 10 minutes — files rarely change
    res.setHeader("Cache-Control", "private, max-age=600");

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
};
