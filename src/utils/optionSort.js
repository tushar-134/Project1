export function isOtherOption(value) {
  return String(value || "").trim().toLowerCase() === "other";
}

export function compareOptionsWithOtherLast(left, right, getLabel = (value) => value) {
  const leftLabel = getLabel(left);
  const rightLabel = getLabel(right);
  const leftIsOther = isOtherOption(leftLabel);
  const rightIsOther = isOtherOption(rightLabel);

  if (leftIsOther && !rightIsOther) return 1;
  if (!leftIsOther && rightIsOther) return -1;
  return String(leftLabel || "").localeCompare(String(rightLabel || ""));
}

export function sortOptionsWithOtherLast(values, getLabel) {
  return [...values].sort((left, right) => compareOptionsWithOtherLast(left, right, getLabel));
}
