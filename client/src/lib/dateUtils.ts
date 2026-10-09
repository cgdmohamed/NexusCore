import { formatDistanceToNow as dateFnsFormatDistanceToNow, format as dateFnsFormat } from "date-fns";
import { ar } from "date-fns/locale/ar";

// Relative times and month names follow the interface language chosen in the language menu
const currentLocale = () => {
  try {
    return localStorage.getItem("language") === "ar" ? ar : undefined;
  } catch {
    return undefined;
  }
};

export const format = (date: Date | number | string, pattern: string): string => {
  const locale = currentLocale();
  // "Oct 08, 2026" becomes "08 أكتوبر 2026": the English comma order scrambles inside right-to-left text
  const p = locale ? pattern.replace(/MMM dd, yyyy/g, "dd MMM yyyy").replace(/MMMM dd, yyyy/g, "dd MMMM yyyy") : pattern;
  return dateFnsFormat(date as Date, p, { locale });
};


/**
 * Safe date formatter that handles invalid dates gracefully
 */
export const formatDistanceToNow = (date: any, options?: any): string => {
  if (!date || date === null || date === undefined) {
    return "Just now";
  }
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return "Just now";
    }
    return dateFnsFormatDistanceToNow(dateObj, { locale: currentLocale(), ...options });
  } catch {
    return "Just now";
  }
};

/**
 * Safe date formatter for display
 */
export const formatDate = (date: any): string => {
  if (!date || date === null || date === undefined) {
    return "N/A";
  }
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }
    return dateObj.toLocaleDateString('en-GB');
  } catch {
    return "N/A";
  }
};