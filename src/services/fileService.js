/**
 * fileService — builds authenticated URLs for the server-side file proxy.
 *
 * Why this exists:
 *   Cloudinary assets under /image/upload/ do not carry CORS headers,
 *   so browser fetch() and Chrome's PDF renderer both fail on direct URLs.
 *   The /api/files/proxy endpoint fetches assets server-to-server (no CORS
 *   restriction) and pipes them back to the browser from our trusted domain.
 *
 * Usage:
 *   import { buildProxyUrl } from "../services/fileService.js";
 *   const safeUrl = buildProxyUrl(attachment.url, attachment.name);
 *   window.open(safeUrl, "_blank");
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
