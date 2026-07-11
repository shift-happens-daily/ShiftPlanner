/** ASCII-safe Unicode symbols (avoids Windows encoding corruption in source files). */
export const EM_DASH = '\u2014';
export const CHECK_MARK = '\u2713';
export const CLOSE_MARK = '\u00D7';

export function formatDateRange(startDate, endDate, fallback = EM_DASH) {
  if (!startDate || !endDate) return fallback;
  if (startDate === endDate) return startDate;
  return `${startDate} ${EM_DASH} ${endDate}`;
}
