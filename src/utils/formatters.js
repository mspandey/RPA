/**
 * formatters.js — shared formatting utilities
 * All currency, percent, and number formatting must go through here.
 * Do NOT duplicate these in components.
 */

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUM_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number as USD currency with $ prefix and thousands separator.
 * @param {number|string} value
 * @returns {string}  e.g.  "$1,234,567"
 */
export function formatCurrency(value) {
  const n = Number(value);
  if (!isFinite(n)) return '$—';
  return USD_FORMATTER.format(n);
}

/**
 * Format a percent value clamped to 2 decimal places with % suffix.
 * @param {number|string} value
 * @returns {string}  e.g.  "12.34%"
 */
export function formatPercent(value) {
  const n = Number(value);
  if (!isFinite(n)) return '—%';
  return n.toFixed(2) + '%';
}

/**
 * Format a plain integer/float with thousands separator.
 * @param {number|string} value
 * @returns {string}  e.g.  "50,000"
 */
export function formatNumber(value) {
  const n = Number(value);
  if (!isFinite(n)) return '—';
  return NUM_FORMATTER.format(n);
}
