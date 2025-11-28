import { useWorkspace } from "@/hooks/use-workspace";

/**
 * Get the currency symbol based on the currency code
 * @param currencyCode The currency code (e.g., USD, EUR, GBP)
 * @returns The currency symbol (e.g., $, €, £)
 */
export const getCurrencySymbol = (currencyCode: string = 'EUR'): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'CA$',
    AUD: 'A$',
  };
  
  return symbols[currencyCode] || currencyCode;
};

/**
 * Get workspace currency from storage
 * @returns Currency code from workspace or default 'EUR'
 */
const getWorkspaceCurrency = (): string => {
  if (typeof window === 'undefined') {
    return 'EUR'; // SSR fallback
  }

  // Try to get from sessionStorage
  const sessionWorkspace = sessionStorage.getItem('currentWorkspace');
  if (sessionWorkspace) {
    try {
      const workspace = JSON.parse(sessionWorkspace);
      if (workspace?.currency) {
        return workspace.currency;
      }
    } catch {
      // Silent fail - continue to other methods
    }
  }

  // Try to get from localStorage as fallback
  const localWorkspace = localStorage.getItem('currentWorkspace');
  if (localWorkspace) {
    try {
      const workspace = JSON.parse(localWorkspace);
      if (workspace?.currency) {
        return workspace.currency;
      }
    } catch {
      // Silent fail - use default
    }
  }

  return 'EUR'; // Default fallback
};

/**
 * Format a price with the workspace currency symbol
 * @param price The price to format
 * @param currencyCode Optional currency code, defaults to workspace currency
 * @returns Formatted price with currency symbol (e.g., $10.00)
 */
export const formatPrice = (price: number, currencyCode?: string): string => {
  const currency = currencyCode || getWorkspaceCurrency();
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${price.toFixed(2)}`;
};

/**
 * Format currency with proper locale and currency code
 * @param amount - The amount to format
 * @param currency - The currency code (default: EUR)
 * @param locale - The locale (default: en-US)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: string = "EUR",
  locale: string = "en-US"
): string => {
  if (isNaN(amount) || !isFinite(amount)) {
    return `0.00 ${currency}`;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
};

/**
 * Format date with proper locale
 * @param date - The date to format
 * @param options - Intl.DateTimeFormatOptions
 * @param locale - The locale (default: en-US)
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  locale: string = "en-US"
): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(dateObj);
};

/**
 * Format time with proper locale
 * @param date - The date to format time from
 * @param locale - The locale (default: en-US)
 * @returns Formatted time string
 */
export const formatTime = (
  date: Date | string,
  locale: string = "en-US"
): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "Invalid time";
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    });

  return formatter.format(dateObj);
};

/**
 * Format a duration in minutes to human-readable format
 * @param minutes Duration in minutes
 * @returns Formatted duration string (e.g., "1h 30min", "45min")
 */
export const formatDuration = (milliseconds: number): string => {
  if (isNaN(milliseconds) || milliseconds < 0) {
    return "0ms";
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  if (seconds > 0) return `${seconds}s`;
  return `${milliseconds}ms`;
};

/**
 * Format a number with thousand separators
 * @param num The number to format
 * @param locale Optional locale, defaults to 'en-US'
 * @returns Formatted number string
 */
export const formatNumber = (
  number: number,
  locale: string = "en-US"
): string => {
  if (isNaN(number) || !isFinite(number)) {
    return "0";
  }

  const formatter = new Intl.NumberFormat(locale);
  return formatter.format(number);
};

/**
 * Format a percentage
 * @param value The percentage value (0-100)
 * @param decimals Number of decimal places, defaults to 1
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1
): string => {
  if (isNaN(value) || !isFinite(value)) {
    return "0%";
  }

  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format a price with the workspace currency symbol - React hook version
 * This hook is preferable in React components where you have access to the context
 */
export const useFormatPrice = () => {
  const { workspace } = useWorkspace();
  
  return (price: number, currencyCode?: string): string => {
    const currency = currencyCode || workspace?.currency || 'EUR';
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${price.toFixed(2)}`;
  };
};

/**
 * Truncate text to specified length
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 50)
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated text
 */
export const truncateText = (
  text: string,
  maxLength: number = 50,
  suffix: string = "..."
): string => {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Format file size in bytes to human readable format
 * @param bytes The file size in bytes
 * @returns Formatted file size (e.g., "1.5 MB", "256 KB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get workspace currency with fallback (enhanced version)
 * @param workspace - Workspace object
 * @returns Currency code
 */
export const getWorkspaceCurrencyCode = (workspace: { currency?: string } | null): string => {
  return workspace?.currency || "EUR";
}; 