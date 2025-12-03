/**
 * Currency formatting utility
 * Supports USD, ILS (Israeli Shekel), and EUR (Euro)
 */

export type Currency = 'USD' | 'ILS' | 'EUR';

/**
 * Format a number as currency based on the currency type
 */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  // Use en-US locale for all currencies to ensure symbol on left
  const currencyCode = currency === 'ILS' ? 'ILS' : currency === 'EUR' ? 'EUR' : 'USD';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number as currency with decimal places
 */
export function formatCurrencyWithDecimals(amount: number, currency: Currency = 'USD', decimals: number = 2): string {
  // Use en-US locale for all currencies to ensure symbol on left
  const currencyCode = currency === 'ILS' ? 'ILS' : currency === 'EUR' ? 'EUR' : 'USD';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency = 'USD'): string {
  if (currency === 'ILS') return '₪';
  if (currency === 'EUR') return '€';
  return '$';
}

/**
 * Format currency for chart tooltips (compact format)
 */
export function formatCurrencyCompact(amount: number, currency: Currency = 'USD'): string {
  const symbol = getCurrencySymbol(currency);
  
  if (amount >= 1000000) {
    return `${symbol}${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(0)}k`;
  } else {
    return formatCurrency(amount, currency);
  }
}

/**
 * Parse a formatted number string (e.g., "50M", "1.3M", "500K") to a number
 * Supports: K (thousands), M (millions), B (billions)
 * Case-insensitive, handles spaces and commas
 */
export function parseFormattedNumber(input: string): number | null {
  if (!input || input.trim() === '') return null;
  
  // Remove currency symbols, spaces, and commas
  let cleaned = input.trim().replace(/[₪$€,\s]/g, '');
  
  if (cleaned === '') return null;
  
  // Check if it ends with K, M, or B
  const lastChar = cleaned.slice(-1).toUpperCase();
  const multiplier = 
    lastChar === 'K' ? 1000 :
    lastChar === 'M' ? 1000000 :
    lastChar === 'B' ? 1000000000 :
    1;
  
  // Extract the numeric part
  const numericPart = multiplier === 1 ? cleaned : cleaned.slice(0, -1);
  
  const number = parseFloat(numericPart);
  if (isNaN(number)) return null;
  
  return number * multiplier;
}

/**
 * Format a number to compact string (e.g., 50000000 -> "50M")
 * Returns the most appropriate format
 */
export function formatNumberCompact(amount: number): string {
  if (amount >= 1000000000) {
    const billions = amount / 1000000000;
    return billions % 1 === 0 ? `${billions}B` : `${billions.toFixed(2)}B`;
  } else if (amount >= 1000000) {
    const millions = amount / 1000000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(2)}M`;
  } else if (amount >= 1000) {
    const thousands = amount / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(2)}K`;
  } else {
    return amount.toString();
  }
}

