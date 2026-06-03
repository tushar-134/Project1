export function toSentenceCase(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
