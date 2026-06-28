/**
 * aggregates.js — Lazy aggregate computation for RowInspector relational context.
 *
 * Computes per-department avg ROI, per-industry budget arrays (for percentile rank),
 * and per-automation-type avg employee_hours_saved.
 *
 * Call computeAggregates(storeMap) once when the inspector first opens (or on
 * demand). Results are cached in this module. Re-compute only when store size
 * changes significantly (caller decides — typically once per inspector session).
 *
 * All computations are O(n) single-pass over the store — cheap enough to run
 * lazily on first open without blocking interaction.
 */

/** @type {{ deptROI: Map, industryBudgets: Map, automationHours: Map, computedAt: number } | null} */
let cache = null;

/**
 * Compute and cache aggregates from the canonical store.
 * Safe to call repeatedly — only recomputes if store.size changed.
 *
 * @param {Map<string, Object>} storeMap
 * @returns {{ deptROI: Map<string,number>, industryBudgets: Map<string,number[]>, automationHours: Map<string,number> }}
 */
export function computeAggregates(storeMap) {
  // Skip recompute if store size hasn't changed since last run
  if (cache && cache.computedAt === storeMap.size) return cache;

  // ── Accumulators ───────────────────────────────────────────────────────────
  /** @type {Map<string, {sum: number, count: number}>} */
  const deptROIAcc = new Map();

  /** @type {Map<string, number[]>} */
  const industryBudgets = new Map();

  /** @type {Map<string, {sum: number, count: number}>} */
  const autoHoursAcc = new Map();

  // ── Single-pass over store ─────────────────────────────────────────────────
  storeMap.forEach(row => {
    const roi     = Number(row.roi_percent);
    const budget  = Number(row.budget_usd);
    const hours   = Number(row.employee_hours_saved);
    const dept    = String(row.department  || '').trim();
    const ind     = String(row.industry    || '').trim();
    const atype   = String(row.automation_type || '').trim();

    // Department avg ROI
    if (dept && isFinite(roi)) {
      if (!deptROIAcc.has(dept)) deptROIAcc.set(dept, { sum: 0, count: 0 });
      const acc = deptROIAcc.get(dept);
      acc.sum   += roi;
      acc.count += 1;
    }

    // Industry budget array (for percentile)
    if (ind && isFinite(budget)) {
      if (!industryBudgets.has(ind)) industryBudgets.set(ind, []);
      industryBudgets.get(ind).push(budget);
    }

    // Automation type avg hours saved
    if (atype && isFinite(hours)) {
      if (!autoHoursAcc.has(atype)) autoHoursAcc.set(atype, { sum: 0, count: 0 });
      const acc = autoHoursAcc.get(atype);
      acc.sum   += hours;
      acc.count += 1;
    }
  });

  // ── Flatten accumulators → final Maps ─────────────────────────────────────
  /** @type {Map<string, number>} dept → avg ROI */
  const deptROI = new Map();
  deptROIAcc.forEach((acc, dept) => {
    deptROI.set(dept, acc.count > 0 ? acc.sum / acc.count : 0);
  });

  // Sort each industry's budget array ascending for percentile rank
  industryBudgets.forEach(arr => arr.sort((a, b) => a - b));

  /** @type {Map<string, number>} automation_type → avg hours saved */
  const automationHours = new Map();
  autoHoursAcc.forEach((acc, atype) => {
    automationHours.set(atype, acc.count > 0 ? acc.sum / acc.count : 0);
  });

  cache = { deptROI, industryBudgets, automationHours, computedAt: storeMap.size };
  return cache;
}

/**
 * Compute percentile rank of `value` within a sorted ascending array.
 * Returns 0–100.
 *
 * @param {number[]} sortedArr
 * @param {number}   value
 * @returns {number}
 */
export function percentileRank(sortedArr, value) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  let below = 0;
  for (let i = 0; i < sortedArr.length; i++) {
    if (sortedArr[i] < value) below++;
    else break;
  }
  return Math.round((below / sortedArr.length) * 100);
}
