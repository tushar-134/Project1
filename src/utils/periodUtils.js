// periodUtils.js — FY and Quarter computation helpers.
// All logic is pure / date-based so it can be imported by both FE components
// and (if ever needed) duplicated into the BE controller with no framework deps.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Parse the "Start - End" string stored in Client.financialYearEnd
 * and return the 0-indexed start month (0 = Jan … 11 = Dec).
 *
 * E.g. "Apr - Mar" → 3
 *      "Jan - Dec" → 0   (calendar year)
 *      ""  / null  → 0   (default to calendar year)
 */
export function parseFYEStartMonth(fyeString) {
  if (!fyeString) return 0;
  const firstPart = fyeString.split("-")[0].trim();
  const idx = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === firstPart.slice(0, 3).toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Given a 0-indexed FY start month, return an array of 4 quarter objects.
 * Each quarter covers exactly 3 consecutive calendar months.
 *
 * Returns:
 *   [{ value: "Jan-Mar", startMonth: 0, endMonth: 2 }, …]
 *
 * The `value` is the label shown in the dropdown AND stored in the DB.
 */
export function getQuarters(fyeString) {
  const startMonth = parseFYEStartMonth(fyeString);
  return Array.from({ length: 4 }, (_, qi) => {
    const qStart = (startMonth + qi * 3) % 12;
    const qEnd = (qStart + 2) % 12;
    return {
      value: `${MONTH_NAMES[qStart]}-${MONTH_NAMES[qEnd]}`,
      startMonth: qStart,
      endMonth: qEnd,
      quarterIndex: qi, // 0-based Q index within the FY
    };
  });
}

/**
 * Build the FY label for a given year and FYE config.
 *
 * For a calendar year (Jan-Dec): "FY 2025"
 * For a non-calendar year FYE:  "FY 2025-26"
 *
 * The `year` argument is the calendar year in which the FY **starts**.
 */
export function buildFYLabel(startYear, fyeString) {
  const startMonth = parseFYEStartMonth(fyeString);
  if (startMonth === 0) {
    // Calendar year — FY starts and ends in the same year
    return `FY ${startYear}`;
  }
  const endYear = startYear + 1;
  return `FY ${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Return an array of FY option strings (for the dropdown).
 * Always starts from FY 2023 (fixed floor) and extends to the current active FY
 * plus one year ahead, growing automatically as years pass.
 *
 * E.g. in 2026 (Apr-Mar FYE):  FY 2023-24, FY 2024-25, FY 2025-26, FY 2026-27
 *      in 2027:                 FY 2023-24 … FY 2027-28
 *
 * The `fyeString` controls whether it's "FY 2025" or "FY 2025-26".
 */
export function getFYOptions(fyeString) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const startMonth = parseFYEStartMonth(fyeString);

  // The FY that is currently active.
  // If today is on or after the FY start month, the FY started this year;
  // otherwise it started last year.
  const currentFYStartYear =
    currentMonth >= startMonth ? currentYear : currentYear - 1;

  // Sliding window: last 5 FYs before current + 1 year ahead, floored at 2023.
  // At 2026: max(2023, 2026-5)=2023 → 2023–2027
  // At 2029: max(2023, 2029-5)=2024 → 2024–2030
  const fromYear = Math.max(2023, currentFYStartYear - 5);
  const toYear = currentFYStartYear + 1;

  const options = [];
  for (let y = fromYear; y <= toYear; y++) {
    options.push(buildFYLabel(y, fyeString));
  }
  return options;
}

/**
 * Given a date and the client's FYE config, return the FY label and
 * quarter value that the date falls in.
 *
 * Returns: { fy: "FY 2025-26", quarter: "Apr-Jun" }
 */
export function getCurrentFYAndQuarter(fyeString, referenceDate) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
  const quarters = getQuarters(fyeString);
  const startMonth = parseFYEStartMonth(fyeString);
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // Find which quarter this month belongs to
  const quarterIndex = quarters.findIndex((q, qi) => {
    const qStart = (startMonth + qi * 3) % 12;
    // Handle wrap-around (e.g. Oct-Dec in an Oct-Sep FY)
    const monthsInQ = [qStart, (qStart + 1) % 12, (qStart + 2) % 12];
    return monthsInQ.includes(month);
  });

  const qi = quarterIndex >= 0 ? quarterIndex : 0;

  // Determine the FY start year for the given date
  let fyStartYear;
  if (startMonth === 0) {
    // Calendar year
    fyStartYear = year;
  } else {
    // Non-calendar: FY started in the year that contains startMonth before today's month
    if (month >= startMonth) {
      fyStartYear = year;
    } else {
      fyStartYear = year - 1;
    }
    // But if we're in Q1 (months startMonth..startMonth+2), FY started this year
    // Correction for quarter spanning year boundary: handled by the quarters array
    // Check if qi < quarterIndex at year boundary
    if (qi === 0 && month < startMonth) {
      // We haven't reached the new FY yet — still in last FY
      fyStartYear = year - 1;
    }
  }

  return {
    fy: buildFYLabel(fyStartYear, fyeString),
    quarter: quarters[qi].value,
  };
}

/**
 * Given a current FY label and quarter value, return the next period.
 * Works for both calendar and non-calendar year FYEs.
 *
 * Returns: { fy: "FY 2025-26", quarter: "Jul-Sep" }
 */
export function getNextPeriod(currentFY, currentQuarter, fyeString) {
  const quarters = getQuarters(fyeString);
  const qi = quarters.findIndex((q) => q.value === currentQuarter);

  if (qi === -1) return { fy: currentFY, quarter: quarters[0].value };

  if (qi < 3) {
    // Same FY, next quarter
    return { fy: currentFY, quarter: quarters[qi + 1].value };
  }

  // Last quarter — roll to next FY
  const startMonth = parseFYEStartMonth(fyeString);
  // Parse the startYear from the current FY label
  const match = currentFY.match(/FY (\d{4})/);
  if (!match) return { fy: currentFY, quarter: quarters[0].value };
  const fyStartYear = parseInt(match[1], 10) + 1;
  return {
    fy: buildFYLabel(fyStartYear, fyeString),
    quarter: quarters[0].value,
  };
}

/**
 * Derive FY and Quarter from a task's dueDate and a client's financialYearEnd.
 * Useful for computing the period of an auto-generated recurring task.
 */
export function getPeriodFromDate(dueDateStr, fyeString) {
  if (!dueDateStr) return { fy: "", quarter: "" };
  const date = new Date(dueDateStr);
  if (isNaN(date.getTime())) return { fy: "", quarter: "" };
  return getCurrentFYAndQuarter(fyeString, date);
}

/**
 * Parse a VAT filing frequency string ("Jan-Mar || Apr-Jun || Jul-Sep || Oct-Dec")
 * and return the quarter that the current (or reference) date falls into.
 */
export function getQuarterFromVatFrequency(filingFrequency, referenceDate) {
  if (!filingFrequency) return "";
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
  const month = date.getMonth();
  
  const parts = String(filingFrequency).split("||").map(p => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const [start, end] = part.split("-");
    if (!start || !end) continue;
    
    const startIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === start.toLowerCase());
    const endIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === end.toLowerCase());
    
    if (startIndex === -1 || endIndex === -1) continue;
    
    if (startIndex <= endIndex) {
      if (month >= startIndex && month <= endIndex) return part;
    } else {
      if (month >= startIndex || month <= endIndex) return part;
    }
  }
  return parts[0] || "";
}
