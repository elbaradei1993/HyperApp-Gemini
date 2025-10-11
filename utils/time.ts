// utils/time.ts

/**
 * Converts an ISO date string to a user-friendly "time ago" format.
 * @param dateString The ISO 8601 date string to convert.
 * @returns A string like "5m ago".
 */
export const timeAgo = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 5) return "just now";

    let interval = seconds / 31536000; // years
    if (interval > 1) return Math.floor(interval) + "y ago";
    
    interval = seconds / 2592000; // months
    if (interval > 1) return Math.floor(interval) + "mo ago";
    
    interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + "d ago";
    
    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + "h ago";
    
    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + "m ago";
    
    return Math.floor(seconds) + "s ago";
}
