function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function normalizeDialCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const digits = digitsOnly(trimmed);
  return digits ? `+${digits}` : "";
}

export function normalizePhoneNumber(value) {
  return digitsOnly(value);
}

export function getPhoneNumberSpec(countryCode) {
  const normalizedCode = normalizeDialCode(countryCode);
  if (normalizedCode === "+971") {
    return { min: 9, max: 9, placeholder: "9-digit number" };
  }
  if (normalizedCode === "+91") {
    return { min: 10, max: 10, placeholder: "10-digit number" };
  }
  return { min: 10, max: 10, placeholder: "10-digit number" };
}
