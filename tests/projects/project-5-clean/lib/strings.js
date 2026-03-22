/**
 * String manipulation utilities
 * Well-tested, production-ready functions
 */

/**
 * Truncate string to maxLength, appending suffix if truncated
 * @param {string} str
 * @param {number} maxLength
 * @param {string} suffix
 * @returns {string}
 */
function truncate(str, maxLength = 100, suffix = '...') {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert string to URL-friendly slug
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => entities[char]);
}

/**
 * Parse a comma-separated string into trimmed array
 * @param {string} str
 * @param {string} delimiter
 * @returns {string[]}
 */
function parseList(str, delimiter = ',') {
  if (typeof str !== 'string' || str.trim() === '') return [];
  return str.split(delimiter).map(item => item.trim()).filter(Boolean);
}

/**
 * Mask sensitive data, showing only last N characters
 * @param {string} value
 * @param {number} visibleChars
 * @param {string} maskChar
 * @returns {string}
 */
function mask(value, visibleChars = 4, maskChar = '*') {
  if (typeof value !== 'string' || value.length <= visibleChars) return value;
  const masked = maskChar.repeat(value.length - visibleChars);
  return masked + value.slice(-visibleChars);
}

module.exports = { truncate, slugify, escapeHtml, parseList, mask };
