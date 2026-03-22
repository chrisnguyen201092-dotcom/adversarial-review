/**
 * Numeric formatting and validation utilities
 */

/**
 * Format number as currency
 * @param {number} amount
 * @param {string} currency
 * @param {string} locale
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Clamp a number between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round to specified decimal places
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage with safe division
 * @param {number} part
 * @param {number} whole
 * @returns {number}
 */
function percentage(part, whole) {
  if (whole === 0) return 0;
  return roundTo((part / whole) * 100);
}

/**
 * Check if a value is a valid positive integer
 * @param {*} value
 * @returns {boolean}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = { formatCurrency, clamp, roundTo, percentage, isPositiveInteger };
