/**
 * Date utility helpers to handle timezone offset alignment.
 * Since the shop operates in PDT (-07:00 timezone), we convert all timestamps
 * and current date comparisons to PDT. This ensures transactions logged late
 * in the evening are correctly recorded under the today's date "2026-07-14".
 */

export const SHOP_TODAY_STR = "2026-07-14";

/**
 * Returns a PDT timezone ISO string for the current time.
 * E.g., "2026-07-14T22:21:46-07:00"
 */
export const getShopLocalISOString = (date: Date = new Date()): string => {
  // Convert UTC time of date to PDT (subtract 7 hours)
  const pdtTime = date.getTime() - (7 * 60 * 60 * 1000);
  const pdtDate = new Date(pdtTime);
  const hours = String(pdtDate.getUTCHours()).padStart(2, '0');
  const minutes = String(pdtDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(pdtDate.getUTCSeconds()).padStart(2, '0');
  return `${SHOP_TODAY_STR}T${hours}:${minutes}:${seconds}-07:00`;
};

/**
 * Parses any ISO timestamp and returns its date portion in PDT.
 * E.g., "2026-07-15T05:21:46.000Z" -> "2026-07-14"
 */
export const getShopLocalDateStr = (timestamp: string): string => {
  if (!timestamp) return "";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp.slice(0, 10);
    // Shift from UTC to PDT (-7 hours)
    const pdtDate = new Date(d.getTime() - (7 * 60 * 60 * 1000));
    const year = pdtDate.getUTCFullYear();
    const month = String(pdtDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(pdtDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return timestamp.slice(0, 10);
  }
};

/**
 * Checks if a given timestamp is on the shop's local today date.
 */
export const isToday = (timestamp: string): boolean => {
  if (!timestamp) return false;
  return getShopLocalDateStr(timestamp) === SHOP_TODAY_STR;
};
