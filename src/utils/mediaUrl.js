function getApiOrigin() {
  const configured = String(import.meta.env.VITE_API_URL || "").trim();
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured, window.location.origin);
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

export function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, window.location.origin);
    const appHost = window.location.hostname;
    const apiOrigin = getApiOrigin();
    if (["localhost", "127.0.0.1"].includes(url.hostname) && ["localhost", "127.0.0.1"].includes(appHost)) {
      url.hostname = appHost;
    }
    if (url.pathname.startsWith("/uploads/") && ["localhost", "127.0.0.1"].includes(url.hostname) && !["localhost", "127.0.0.1"].includes(appHost)) {
      return `${apiOrigin}${url.pathname}`;
    }
    if (url.pathname.startsWith("/uploads/") && !/^https?:$/i.test(url.protocol)) {
      return `${apiOrigin}${url.pathname}`;
    }
    return url.toString();
  } catch {
    return raw;
  }
}


/**
 * Opens a document URL safely across all browsers via the server-side file proxy.
 *
 * Root cause of the Chrome PDF bug:
 *   1. Cloudinary's CDN does not return Access-Control-Allow-Origin headers for
 *      /image/upload/ assets → browser fetch() is CORS-blocked.
 *   2. window.open with noopener,noreferrer strips the Referer header → Chrome's
 *      PDF renderer secondary fetch also fails.
 *   Safari sidesteps both by immediately downloading instead of rendering inline.
 *
 * Fix strategy:
 *   Instead of fetching Cloudinary directly from the browser, we open a URL
 *   to our own Express proxy (/api/files/proxy?url=...). The server fetches
 *   the asset server-to-server (no CORS restriction), sets Content-Type and
 *   Content-Disposition, and pipes bytes back. The browser sees the file as
 *   coming from our own trusted domain — Chrome's PDF viewer works perfectly.
 *   Works for BOTH legacy /image/upload/ and new /raw/upload/ Cloudinary paths.
 */
export function openDocumentSafely(rawUrl, filename = "") {
  const pendingTab = window.open("about:blank", "_blank");

  // Lazy import to avoid circular dependencies and keep mediaUrl.js lightweight.
  import("../services/fileService.js").then(async ({ buildProxyUrl, getSignedDocumentUrl }) => {
    let openUrl = "";
    try {
      openUrl = await getSignedDocumentUrl({ url: rawUrl, filename });
    } catch {
      openUrl = buildProxyUrl(rawUrl, filename);
    }

    if (!openUrl) {
      pendingTab?.close();
      return;
    }

    if (pendingTab) pendingTab.location.href = openUrl;
    else window.open(openUrl, "_blank", "noopener,noreferrer");
  }).catch(() => {
    // Fallback: direct open (works for /uploads/ local files and permissive CDNs).
    const resolved = resolveMediaUrl(rawUrl);
    if (resolved && pendingTab) pendingTab.location.href = resolved;
    else if (resolved) window.open(resolved, "_blank", "noopener,noreferrer");
    else pendingTab?.close();
  });
}

