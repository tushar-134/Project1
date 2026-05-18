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
  void countryCode;
  return { min: 10, max: 10, placeholder: "10-digit number" };
}
