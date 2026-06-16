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
 * Opens a document URL safely across all browsers.
 *
 * Root cause of the Chrome PDF bug:
 *   window.open(url, "_blank", "noopener,noreferrer") strips the Referer header.
 *   Chrome's built-in PDF renderer makes a secondary cross-origin fetch to the
 *   Cloudinary CDN — without a Referer, Cloudinary rejects it and the viewer
 *   shows "Failed to load PDF document". Safari avoids this by immediately
 *   downloading rather than rendering inline, so it works there.
 *
 * Fix strategy:
 *   Fetch the file ourselves as a blob (no browser renderer involved, no
 *   Referer restriction), create a temporary object URL, and open that instead.
 *   This works identically in Chrome, Safari, Firefox, and Edge.
 */
export async function openDocumentSafely(rawUrl, filename = "") {
  const url = resolveMediaUrl(rawUrl);
  if (!url) return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    // Derive filename from URL if not provided
    const name = filename || url.split("/").pop()?.split("?")[0] || "document";

    // Open inline for PDFs (the object URL has no CORS issue), download otherwise
    const isPdf = blob.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const win = window.open(objectUrl, "_blank");
      // Revoke after 60s — enough time for the viewer to load the bytes
      if (win) setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } else {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
    }
  } catch {
    // Fallback: open the raw URL directly (works in environments where fetch
    // is blocked but CORS headers are permissive, e.g. local /uploads files)
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
