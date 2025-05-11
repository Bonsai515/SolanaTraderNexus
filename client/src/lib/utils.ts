/**
 * Utility functions for the Solana Quantum Trading Platform
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names with tailwind-merge
 * This allows for proper overriding of tailwind classes when combining
 * base styles with customization.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric value as a currency string
 * @param value The numeric value to format
 * @param currency The currency code (default: "USD")
 * @param minimumFractionDigits Minimum fraction digits to display (default: 2)
 * @param maximumFractionDigits Maximum fraction digits to display (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency = "USD",
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format a number with thousands separator and specified decimal places
 * @param value The numeric value to format
 * @param decimalPlaces The number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimalPlaces = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

/**
 * Format a date to a readable string
 * @param date The date to format
 * @param includeTime Whether to include the time (default: true)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, includeTime = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (includeTime) {
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Truncate a string to a maximum length with ellipsis
 * @param str The string to truncate
 * @param maxLength The maximum length (default: 30)
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength = 30): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

/**
 * Format a crypto wallet address for display (shows beginning and end only)
 * @param address The wallet address to format
 * @param startChars The number of characters to show at the start (default: 6)
 * @param endChars The number of characters to show at the end (default: 4)
 * @returns Formatted wallet address
 */
export function formatWalletAddress(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (!address || address.length <= startChars + endChars) return address;
  return `${address.substring(0, startChars)}...${address.substring(
    address.length - endChars
  )}`;
}

/**
 * Generate a random color based on a string (useful for consistent colors for the same input)
 * @param str Input string to derive color from
 * @returns Hex color string
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  
  return color;
}

/**
 * Calculate the time difference between now and a given date in a readable format
 * @param date The date to compare
 * @returns A human-readable string of the time difference
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;
  if (interval === 1) return "1 year ago";
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  if (interval === 1) return "1 month ago";
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  if (interval === 1) return "1 day ago";
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  if (interval === 1) return "1 hour ago";
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  if (interval === 1) return "1 minute ago";
  
  if (seconds < 10) return "just now";
  
  return `${Math.floor(seconds)} seconds ago`;
}

/**
 * Check if a value is a valid number
 * @param value The value to check
 * @returns True if the value is a valid number, false otherwise
 */
export function isValidNumber(value: any): boolean {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Convert a UTC date to local timezone
 * @param utcDate The UTC date to convert
 * @returns Date in local timezone
 */
export function utcToLocalDate(utcDate: string | Date): Date {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
}

/**
 * Get a readable time from milliseconds
 * @param ms Milliseconds
 * @returns Formatted time string (e.g., "2m 30s")
 */
export function formatTimeFromMs(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(" ");
}

/**
 * Safely access nested properties in an object without errors
 * @param obj The object to access
 * @param path The path to the property (e.g., "user.address.city")
 * @param defaultValue The default value to return if the property doesn't exist (default: undefined)
 * @returns The property value or the default value
 */
export function getNestedValue(obj: any, path: string, defaultValue: any = undefined): any {
  try {
    return path.split('.').reduce((o, p) => o?.[p], obj) ?? defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Debounce a function to limit how often it can be called
 * @param func The function to debounce
 * @param wait The number of milliseconds to wait
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Add a delay using a promise
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random ID (useful for keys in lists)
 * @param length The length of the ID (default: 10)
 * @returns Random ID string
 */
export function generateId(length = 10): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Calculate percentage change between two values
 * @param oldValue The original value
 * @param newValue The new value
 * @returns Percentage change
 */
export function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Format a percentage value with sign
 * @param value The percentage value
 * @param decimalPlaces The number of decimal places (default: 2)
 * @returns Formatted percentage string with sign
 */
export function formatPercentage(value: number, decimalPlaces = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimalPlaces)}%`;
}