export const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "previous_day", label: "Previous Day" },
  { value: "previous_week", label: "Previous Week" },
  { value: "previous_month", label: "Previous Month" },
  { value: "specific_month", label: "Specific Month" },
  { value: "custom", label: "Custom Range" },
  
];

const pad = (num) => String(num).padStart(2, "0");
const formatDate = (date) => {
  if (!date) return undefined;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function getDateRangeBounds(rangeType) {
  if (!rangeType || rangeType === "all") return { fromDate: undefined, toDate: undefined };

  const now = new Date();
  let fromDate = new Date(now);
  let toDate = new Date(now);

  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 = Monday for "This Week"
  const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;

  switch (rangeType) {
    case "today":
      // fromDate and toDate stay as now
      break;

    case "this_week":
      fromDate.setDate(now.getDate() - dayOfWeek);
      toDate.setDate(fromDate.getDate() + 6);
      break;

    case "this_month":
      fromDate.setDate(1);
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
      break;

    case "previous_day":
      fromDate.setDate(now.getDate() - 1);
      toDate.setDate(now.getDate() - 1);
      break;

    case "previous_week":
      fromDate.setDate(now.getDate() - dayOfWeek - 7);
      toDate = new Date(fromDate);
      toDate.setDate(fromDate.getDate() + 6);
      break;

    case "previous_month":
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;

    default:
      return { fromDate: undefined, toDate: undefined };
  }

  return {
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate),
  };
}
