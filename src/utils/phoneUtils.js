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
    return { min: 7, max: 15, placeholder: "Enter mobile number" };
  }
  if (normalizedCode === "+91") {
    return { min: 7, max: 15, placeholder: "Enter mobile number" };
  }
  return { min: 7, max: 15, placeholder: "Enter mobile number" };
}
