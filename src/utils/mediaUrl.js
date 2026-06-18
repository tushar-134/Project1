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

function getParsedUrl(value) {
  try {
    return new URL(String(value || ""), window.location.origin);
  } catch {
    return null;
  }
}

function isAwsStorageUrl(value) {
  const url = getParsedUrl(value);
  if (!url) return false;
  return (
    url.searchParams.has("X-Amz-Signature")
    || url.searchParams.has("X-Amz-Credential")
    || url.searchParams.has("X-Amz-Algorithm")
    || url.hostname === "s3.amazonaws.com"
    || url.hostname.endsWith(".amazonaws.com")
    || /\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(url.hostname)
    || /\.s3\.amazonaws\.com$/i.test(url.hostname)
  );
}

function canUseLegacyProxy(value) {
  const url = getParsedUrl(value);
  if (!url) return false;
  if (url.hostname === "res.cloudinary.com") return true;
  return url.pathname.startsWith("/uploads/");
}

export function openDocumentSafely(rawUrl, filename = "") {
  const pendingTab = window.open("about:blank", "_blank");

  // Lazy import to avoid circular dependencies and keep mediaUrl.js lightweight.
  import("../services/fileService.js").then(async ({ buildProxyUrl, getSignedDocumentUrl }) => {
    let openUrl = "";
    try {
      openUrl = await getSignedDocumentUrl({ url: rawUrl, filename });
    } catch (error) {
      pendingTab?.close();

      // Show the server's message (e.g. "File no longer exists in storage...")
      // as a toast instead of a blocking browser alert.
      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        "";

      if (isAwsStorageUrl(rawUrl)) {
        const resolved = resolveMediaUrl(rawUrl);
        if (getParsedUrl(resolved)?.searchParams.has("X-Amz-Signature")) {
          // We have a valid existing presigned URL — open it directly.
          if (pendingTab) pendingTab.location.href = resolved;
          else window.open(resolved, "_blank", "noopener,noreferrer");
          return;
        }
        // Show the server error or a generic fallback.
        import("react-hot-toast").then(({ default: toast }) => {
          toast.error(serverMessage || "Unable to open document. Please re-upload it or contact admin.");
        });
        return;
      }

      if (canUseLegacyProxy(rawUrl)) {
        // Legacy Cloudinary / /uploads/ — fall back to proxy.
        openUrl = buildProxyUrl(rawUrl, filename);
        if (pendingTab) pendingTab.location.href = openUrl;
        else window.open(openUrl, "_blank", "noopener,noreferrer");
        return;
      }

      import("react-hot-toast").then(({ default: toast }) => {
        toast.error(serverMessage || "Unable to open document. Please try again or contact admin.");
      });
      return;
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

