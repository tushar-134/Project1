function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeDialCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const digits = digitsOnly(trimmed);
  return digits ? `+${digits}` : "";
}

function normalizePhoneNumber(value) {
  return digitsOnly(value);
}

function getPhoneNumberSpec(countryCode) {
  const normalizedCode = normalizeDialCode(countryCode);
  if (normalizedCode === "+971") {
    return { min: 9, max: 9 };
  }
  if (normalizedCode === "+91") {
    return { min: 10, max: 10 };
  }
  return { min: 10, max: 10 };
}

function isValidPhone(countryCode, number) {
  const digits = normalizePhoneNumber(number);
  if (!digits) return false;
  const { min, max } = getPhoneNumberSpec(countryCode);
  return digits.length >= min && digits.length <= max;
}

module.exports = {
  normalizeDialCode,
  normalizePhoneNumber,
  getPhoneNumberSpec,
  isValidPhone,
};
