/**
 * viewEngine.js — Filter → FuzzySearch → Sort pipeline
 *
 * Architecture:
 *   • computeView() is a pure function: given the canonical store Map and
 *     the current criteria object, returns a sorted+filtered RowObject[].
 *   • This function must be called at most once per 200ms tick (throttled
 *     by the caller via rAF / dirty flag) to avoid re-sorting 50,000 rows
 *     at stream tick rate.
 *   • Sort: multi-key chained comparator. Falls through to next key on tie.
 *   • Filter: AND across different fields, OR within same field's selections.
 *   • Search: delegated to fuzzyFilter() from fuzzySearch.js.
 *
 * Pipeline order (matters for performance):
 *   store.values() → Array (once) → categorical filter → fuzzy search → sort
 *
 * The sort step is applied LAST so it only operates on the already-narrowed
 * set — in a heavily filtered view this can be orders of magnitude cheaper
 * than sorting the full 50,000-row dataset.
 */

import { fuzzyFilter } from '../utils/fuzzySearch.js';

// ─── Sort comparator factory ──────────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'budget_usd',
  'annual_savings_usd',
  'roi_percent',
  'robots_deployed',
  'employee_hours_saved'
]);

/**
 * Build a chained multi-key comparator from sortKeys.
 *
 * @param {{ field: string, dir: 'asc'|'desc' }[]} sortKeys
 * @returns {(a: Object, b: Object) => number}
 */
function buildComparator(sortKeys) {
  return function compare(a, b) {
    for (let i = 0; i < sortKeys.length; i++) {
      const { field, dir } = sortKeys[i];
      const av = a[field];
      const bv = b[field];
      let result = 0;

      if (NUMERIC_FIELDS.has(field)) {
        const an = Number(av ?? 0);
        const bn = Number(bv ?? 0);
        result = an - bn;
      } else if (typeof av === 'number' && typeof bv === 'number') {
        result = av - bv;
      } else {
        const as = String(av ?? '').toLowerCase();
        const bs = String(bv ?? '').toLowerCase();
        result = as < bs ? -1 : as > bs ? 1 : 0;
      }

      if (result !== 0) return dir === 'asc' ? result : -result;
    }
    return 0;
  };
}

// ─── Categorical filter ───────────────────────────────────────────────────────

/**
 * Filter rows by categorical field selections.
 * Selection logic:
 *   - AND across different filter fields
 *   - OR within multiple selections on the same field
 *
 * @param {Object[]} rows
 * @param {Object<string, Set<string>>} filters  — e.g. { automation_type: Set{'RPA','Email'}, department: Set{'Finance'} }
 * @returns {Object[]}
 */
function applyFilters(rows, filters) {
  const filterEntries = Object.entries(filters).filter(([, vals]) => vals.size > 0);
  if (filterEntries.length === 0) return rows;

  return rows.filter(row => {
    // All active filter fields must match (AND)
    for (let i = 0; i < filterEntries.length; i++) {
      const [field, vals] = filterEntries[i];
      const rowVal = String(row[field] ?? '').trim();
      // OR within the field's selected values
      if (!vals.has(rowVal)) return false;
    }
    return true;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the sorted+filtered+searched view from the canonical store.
 *
 * @param {Map<string, Object>} storeMap
 * @param {{
 *   filters:     Object<string, Set<string>>,
 *   searchQuery: string,
 *   sortKeys:    { field: string, dir: 'asc'|'desc' }[]
 * }} criteria
 * @returns {Object[]}
 */
export function computeView(storeMap, criteria) {
  const { filters = {}, searchQuery = '', sortKeys = [] } = criteria;

  // 1. Materialize store into array (single pass)
  const rows = Array.from(storeMap.values());

  // 2. Categorical filter (AND across fields, OR within)
  const filtered = applyFilters(rows, filters);

  // 3. Fuzzy search
  const searched = fuzzyFilter(filtered, searchQuery);

  // 4. Multi-key sort (only when sort keys are defined)
  if (sortKeys.length > 0) {
    searched.sort(buildComparator(sortKeys));
  }

  return searched;
}

/**
 * Extract distinct values for a given field from the store.
 * Used by FilterDropdown to populate its option list.
 *
 * @param {Map<string, Object>} storeMap
 * @param {string} field
 * @returns {string[]}  sorted distinct values
 */
export function getDistinctValues(storeMap, field) {
  const seen = new Set();
  storeMap.forEach(row => {
    const val = String(row[field] ?? '').trim();
    if (val) seen.add(val);
  });
  return Array.from(seen).sort();
}
