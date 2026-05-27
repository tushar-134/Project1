function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeConfiguredOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function getPublicOrigin(req) {
  const configured =
    normalizeConfiguredOrigin(process.env.PUBLIC_SERVER_URL)
    || normalizeConfiguredOrigin(process.env.API_PUBLIC_URL)
    || normalizeConfiguredOrigin(process.env.SERVER_PUBLIC_URL)
    || normalizeConfiguredOrigin(process.env.APP_BASE_URL)
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).trim()}` : "")
    || normalizeConfiguredOrigin(process.env.RAILWAY_STATIC_URL);

  if (configured) return configured;
  if (!req) return "";

  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get?.("host") || "";
  return host ? `${protocol}://${host}` : "";
}

function normalizeStoredUploadUrl(value, req) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const publicOrigin = getPublicOrigin(req);

  if (raw.startsWith("/uploads/")) {
    return publicOrigin ? `${trimTrailingSlash(publicOrigin)}${raw}` : raw;
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.pathname.startsWith("/uploads/")) return raw;

    const isLocalHost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (isLocalHost && publicOrigin) {
      return `${trimTrailingSlash(publicOrigin)}${parsed.pathname}`;
    }

    return raw;
  } catch {
    return raw;
  }
}

function buildUploadedFileUrl(file, req) {
  const directPath = String(file?.path || "").trim();
  if (/^https?:\/\//i.test(directPath)) {
    return normalizeStoredUploadUrl(directPath, req);
  }

  const publicOrigin = getPublicOrigin(req);
  const uploadPath = `/uploads/${file.filename}`;
  return publicOrigin ? `${trimTrailingSlash(publicOrigin)}${uploadPath}` : uploadPath;
}

module.exports = {
  buildUploadedFileUrl,
  getPublicOrigin,
  normalizeStoredUploadUrl,
};
