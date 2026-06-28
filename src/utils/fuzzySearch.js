/**
 * fuzzySearch.js — token-based multi-field substring matcher
 *
 * Algorithm:
 *   1. Split the query string on whitespace into tokens.
 *   2. For each token, check if it appears as a substring in ANY of the
 *      target fields (case-insensitive).
 *   3. Return true only if EVERY token matched somewhere across the fields.
 *
 * This satisfies "out-of-order partial match" (tokens are checked
 * independently, not as a contiguous phrase) without heavier Levenshtein
 * distance computation, which is overkill for a 12-hour build.
 *
 * Target fields: project_name, company_id, implementation_partner, country
 */

/** @type {string[]} */
const SEARCH_FIELDS = [
  'project_name',
  'company_id',
  'implementation_partner',
  'country',
];

/**
 * Returns true if every whitespace-separated token in `query` appears as
 * a substring in at least one of the SEARCH_FIELDS on `row`.
 *
 * @param {Object} row   — a RowObject from rpaStore
 * @param {string} query — the raw search query string
 * @returns {boolean}
 */
export function fuzzyMatch(row, query) {
  if (!query) return true;

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Pre-compute lowercase field values once per row per call
  const fieldValues = SEARCH_FIELDS.map(f =>
    (row[f] != null ? String(row[f]) : '').toLowerCase()
  );

  // Every token must appear somewhere across the fields
  return tokens.every(token =>
    fieldValues.some(val => val.includes(token))
  );
}

/**
 * Filter an array of rows using fuzzyMatch.
 * Returns a new array (does not mutate input).
 *
 * @param {Object[]} rows
 * @param {string}   query
 * @returns {Object[]}
 */
export function fuzzyFilter(rows, query) {
  if (!query || !query.trim()) return rows;
  return rows.filter(row => fuzzyMatch(row, query));
}
