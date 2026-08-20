/**
 * Formats an ISO-8601 UTC timestamp string from the backend into the exact local date/time 
 * in the user's browser timezone in the format: DD MMM YYYY • hh:mm:ss AM/PM TZ
 */
export const formatLocalTimestamp = (isoString: string | null | undefined): string => {
  if (!isoString) return "Unknown Time";
  try {
    let normalized = isoString;
    // If it doesn't end with Z or a timezone offset like +00:00 or -05:00, append Z (default backend UTC)
    if (!normalized.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "Unknown Time";
    
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = hours.toString().padStart(2, '0');
    
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    let tzAbbr = "";
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      if (tzPart) {
        tzAbbr = " " + tzPart.value;
      }
    } catch (e) {}

    return `${day} ${month} ${year} • ${strHours}:${minutes}:${seconds} ${ampm}${tzAbbr}`;
  } catch (e) {
    return "Unknown Time";
  }
};

export const getVersionLabel = (versionNumber: number | null | undefined): string => {
  if (versionNumber == null) return "V?";
  return `V${versionNumber}`;
};

/**
 * Formats a last_updated ISO-8601 timestamp into a relative or exact local time format:
 * - "Just now" (< 60 secs)
 * - "5 minutes ago" (< 60 mins)
 * - "Today • 10:42 AM"
 * - "Yesterday • 08:30 PM"
 * - "21 Jul 2026 • 07:15 PM"
 */
export const formatRelativeOrLocalTimestamp = (isoString: string | null | undefined): string => {
  if (!isoString) return "Never";
  try {
    let normalized = isoString;
    if (!normalized.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const strHours = hours.toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${strHours}:${minutes} ${ampm}`;

    if (diffSec < 60 && diffSec >= 0) {
      return "Just now";
    }
    if (diffMin < 60 && diffMin > 0) {
      return `${diffMin} min ago`;
    }
    if (diffHours < 24 && diffHours > 0) {
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return `Today • ${timeStr}`;
      }
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    }

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Today • ${timeStr}`;
    }
    if (isYesterday) {
      return `Yesterday • ${timeStr}`;
    }
    if (diffDays < 7 && diffDays > 0) {
      return `${diffDays} days ago`;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];

    return `${day} ${month} • ${timeStr}`;
  } catch (e) {
    return "Never";
  }
};
