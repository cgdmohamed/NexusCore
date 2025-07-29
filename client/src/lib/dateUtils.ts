import { formatDistanceToNow as dateFnsFormatDistanceToNow } from "date-fns";

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
    return dateFnsFormatDistanceToNow(dateObj, options);
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
    return dateObj.toLocaleDateString();
  } catch {
    return "N/A";
  }
};