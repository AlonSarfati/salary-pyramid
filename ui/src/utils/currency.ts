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

