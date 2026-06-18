import api from "./api.js";

/**
 * fileService — builds safe document access URLs.
 *
 * New S3 uploads use short-lived AWS pre-signed URLs from /api/files/signed-url.
 * The proxy URL remains as a fallback for legacy Cloudinary and local /uploads/
 * documents.
 */

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  try {
    const url = new URL(configured);
    const appHost = window.location.hostname;
    if (["localhost", "127.0.0.1"].includes(url.hostname) && ["localhost", "127.0.0.1"].includes(appHost)) {
      url.hostname = appHost;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

/**
 * Builds a URL to the /api/files/proxy endpoint for the given asset URL.
 * The JWT token is appended as a query param so the browser can open it
 * directly in a new tab (no XHR required — the server-side proxy handles auth).
 *
 * @param {string} rawUrl   - The Cloudinary or /uploads/ URL stored in MongoDB.
 * @param {string} filename - Optional display filename for Content-Disposition.
 * @returns {string}        - Absolute URL to the proxy endpoint.
 */
export function buildProxyUrl(rawUrl, filename = "") {
  if (!rawUrl) return "";
  const base = resolveApiBase();
  const params = new URLSearchParams({ url: rawUrl });
  if (filename) params.set("filename", filename);

  // Attach the JWT as a query param so the browser can navigate to this URL
  // in a new tab without needing an XHR/fetch (auth middleware reads Bearer token
  // from header OR from the `token` query param — see authMiddleware).
  const token = localStorage.getItem("filingBuddyToken");
  if (token) params.set("token", token);

  return `${base}/files/proxy?${params.toString()}`;
}

export async function getSignedDocumentUrl({ url = "", key = "", filename = "", contentType = "" } = {}) {
  const params = {};
  if (key) params.key = key;
  if (url) params.url = url;
  if (filename) params.filename = filename;
  if (contentType) params.contentType = contentType;
  const response = await api.get("/files/signed-url", { params });
  return response.data?.url || "";
}
