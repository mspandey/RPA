/**
 * rpaStore.js — Canonical data store + stream ingestion
 *
 * Architecture:
 *   • Single Map<internal_uid, RowObject> as canonical store.
 *     O(1) lookup/update per row, never replaced wholesale on tick.
 *   • Pause/Play: when paused, incoming batches still merge into the Map
 *     (no data dropped), but subscribers are NOT notified (grid freeze).
 *     On play(), subscribers are notified once to flush accumulated state.
 *   • Running KPI totals are maintained separately as rolling sums.
 *     They increment on every batch regardless of pause state (data
 *     continues accumulating even when view is frozen).
 *   • Subscriber pattern: a Set<fn> — called after each batch merge
 *     with { kpiOnly: boolean } so KpiStrip can tick while grid is paused.
 */

// ─── Canonical store ──────────────────────────────────────────────────────────

/** @type {Map<string, Object>} */
const store = new Map();

// ─── KPI running totals ───────────────────────────────────────────────────────

/** Total individual row-updates received from the stream (not unique rows). */
let totalRowsProcessed = 0;

/**
 * Cumulative sum of robots_deployed across every received batch row.
 * NOTE: this is a running sum of EVERY row in every batch, not a snapshot
 * of the current store — it only ever grows.
 */
let cumulativeRobots = 0;

/**
 * Cumulative sum of annual_savings_usd across every received batch row.
 */
let cumulativeAnnualSavings = 0;

// ─── Pause / play state ───────────────────────────────────────────────────────

let isPaused = false;

// ─── Subscriber registry ──────────────────────────────────────────────────────

/** @type {Set<Function>} */
const subscribers = new Set();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process a batch of incoming rows from dataStream.js.
 * Merges each row into the canonical Map (O(1) per row).
 * Always updates KPI totals.
 * Notifies subscribers only when NOT paused.
 *
 * @param {Object[]} batch — incomingBatch from window.initializeRpaStream callback
 */
export function processBatch(batch) {
  // Merge into canonical Map — always, regardless of pause state
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    store.set(row.internal_uid, row);

    // Running KPI totals — accumulate from every row in every batch
    totalRowsProcessed += 1;
    const robots = Number(row.robots_deployed) || 0;
    const savings = Number(row.annual_savings_usd) || 0;
    cumulativeRobots       += robots;
    cumulativeAnnualSavings += savings;
  }

  // Notify all subscribers (KPI always updates; grid gated by isPaused in subscriber)
  notifySubscribers(isPaused ? { kpiOnly: true } : { kpiOnly: false });
}

/**
 * Subscribe to store updates.
 * @param {Function} fn — called with ({ kpiOnly: boolean })
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Pause: freeze grid renders (KPI still ticks via kpiOnly notification). */
export function pause() {
  isPaused = true;
}

/**
 * Play: unfreeze. Immediately fires a full notification so the grid
 * flushes all accumulated state in one render pass.
 */
export function play() {
  isPaused = false;
  notifySubscribers({ kpiOnly: false });
}

/** @returns {boolean} */
export function getIsPaused() {
  return isPaused;
}

/**
 * Get the raw canonical Map (read-only intent — do not mutate externally).
 * @returns {Map<string, Object>}
 */
export function getStore() {
  return store;
}

/** @returns {{ totalRowsProcessed: number, cumulativeRobots: number, cumulativeAnnualSavings: number }} */
export function getKpiTotals() {
  return { totalRowsProcessed, cumulativeRobots, cumulativeAnnualSavings };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function notifySubscribers(payload) {
  subscribers.forEach(fn => fn(payload));
}
