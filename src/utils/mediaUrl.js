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
