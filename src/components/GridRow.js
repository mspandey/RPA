/**
 * GridRow.js — DOM factory for virtualized row nodes
 *
 * Performance strategy: imperative DOM mutation only — zero React reconciliation.
 *
 * Bug fixes applied:
 *   • Title attribute added to truncatable text cells (project_name, country,
 *     industry, automation_type, department) so hovering shows full value.
 *   • Duplicate "FAILED" badge removed — the status-badge itself is already
 *     red for Failed rows. The separate failed-badge span was dead code.
 *   • At-rest FAILED glow class ('row-failed-state') is toggled each tick
 *     so currently-failed rows have a persistent low-level pulse, distinct
 *     from the one-time row-alert-flash transition animation.
 */

import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters.js';

// ─── Column layout definition — single source of truth ───────────────────────

export const COLUMNS = [
  { key: 'project_id',           label: 'PRJ // ID',      cls: 'col-project-id',      numeric: false },
  { key: 'project_name',         label: 'PRJ // NAME',    cls: 'col-project-name',    numeric: false, truncatable: true },
  { key: 'project_status',       label: 'STATUS // CRIT', cls: 'col-status',          numeric: false },
  { key: 'automation_type',      label: 'AUTO // TYPE',   cls: 'col-automation-type', numeric: false, truncatable: true },
  { key: 'department',           label: 'DEPT // LOC',    cls: 'col-department',      numeric: false, truncatable: true },
  { key: 'country',              label: 'GEO // LOC',     cls: 'col-country',         numeric: false, truncatable: true },
  { key: 'industry',             label: 'IND // SEC',     cls: 'col-industry',        numeric: false, truncatable: true },
  { key: 'budget_usd',           label: 'BUDGET // USD',  cls: 'col-budget',          numeric: true, format: 'currency' },
  { key: 'annual_savings_usd',   label: 'SAVINGS // USD', cls: 'col-annual-savings',  numeric: true, format: 'currency' },
  { key: 'roi_percent',          label: 'ROI // PCT',     cls: 'col-roi',             numeric: true, format: 'percent' },
  { key: 'robots_deployed',      label: 'ROBOTS // QTY',  cls: 'col-robots',          numeric: true, format: 'number' },
  { key: 'employee_hours_saved', label: 'HOURS // SAVED', cls: 'col-hours-saved',     numeric: true, format: 'number' },
];

// Pre-compute set of truncatable field keys for O(1) lookup in updateRowElement
const TRUNCATABLE_KEYS = new Set(COLUMNS.filter(c => c.truncatable).map(c => c.key));

// ─── Row element factory ──────────────────────────────────────────────────────

/**
 * Create a blank row DOM element with pre-structured child cells.
 * Called ONCE per pool slot on mount. Never called again for the same slot.
 *
 * @param {number} poolIndex
 * @returns {HTMLDivElement}
 */
export function createRowElement(poolIndex) {
  const row = document.createElement('div');
  row.className = 'grid-row row-even';
  row.setAttribute('role', 'row');
  row.dataset.poolIndex = poolIndex;
  row.dataset.rowId = ''; // stamped by updateRowElement with internal_uid

  COLUMNS.forEach(col => {
    const cell = document.createElement('div');
    cell.className = `cell ${col.cls}${col.numeric ? ' numeric' : ''}${col.format === 'currency' ? ' currency' : ''}`;
    cell.setAttribute('role', 'cell');
    cell.dataset.key = col.key;

    if (col.key === 'project_status') {
      // Single badge span — no secondary failed-badge (Bug #2 fix: removed duplicate)
      const badge = document.createElement('span');
      badge.dataset.role = 'status-badge';
      cell.appendChild(badge);

    } else if (col.key === 'roi_percent') {
      const span = document.createElement('span');
      span.dataset.role = 'roi-value';
      cell.appendChild(span);

    } else {
      cell.textContent = '';
    }

    row.appendChild(cell);
  });

  return row;
}

// ─── Alert flash guard — track last alert state per pool slot ─────────────────

const rowAlertState = new WeakMap(); // row el → was-alert boolean

// Threshold above which annual_savings_usd is highlighted as "high savings"
const HIGH_SAVINGS_THRESHOLD = 3_000_000;

/**
 * Update an existing row element in place.
 * Direct DOM mutation — avoids React reconciliation.
 *
 * @param {HTMLDivElement} el
 * @param {Object|null}    row       — null → hide the row (out-of-bounds slot)
 * @param {number}         dataIndex — absolute index in the view array
 */
export function updateRowElement(el, row, dataIndex) {
  if (!row) {
    el.style.display = 'none';
    return;
  }

  el.style.display = '';

  // Stamp stable identity — used by VirtualizedGrid click delegation.
  // internal_uid is the canonical Map key; never changes for a given row.
  el.dataset.rowId = row.internal_uid || '';

  // Position via GPU-composited transform (avoids layout thrash)
  const ROW_HEIGHT = 36;
  el.style.transform = `translateY(${dataIndex * ROW_HEIGHT}px)`;

  // Alternating stripe
  const isEven = dataIndex % 2 === 0;
  el.classList.toggle('row-even', isEven);
  el.classList.toggle('row-odd', !isEven);

  // Alert detection — determine if this row is currently in an alert state
  const isFailed   = row.project_status === 'Failed';
  const isNegROI   = Number(row.roi_percent) < 0;
  const shouldAlert = isFailed || isNegROI;
  const wasAlert    = rowAlertState.get(el) || false;

  // One-time flash animation: only fires on TRANSITION INTO alert state
  if (shouldAlert && !wasAlert && !el.classList.contains('row-alert-flash')) {
    el.classList.add('row-alert-flash');
    el.addEventListener('animationend', function cleanup() {
      el.classList.remove('row-alert-flash');
      el.removeEventListener('animationend', cleanup);
    }, { once: true });
  }

  // At-rest state: persistent glow for currently-failed rows (Part B Bug fix)
  // Distinct from the one-time flash — this persists as long as status === Failed
  el.classList.toggle('row-failed-state', isFailed);

  rowAlertState.set(el, shouldAlert);

  // ─── Update each cell ───────────────────────────────────────────────────────

  const cells = el.children;
  for (let i = 0; i < COLUMNS.length; i++) {
    const col    = COLUMNS[i];
    const cell   = cells[i];
    const rawVal = row[col.key];

    if (col.key === 'project_status') {
      const badge  = cell.querySelector('[data-role="status-badge"]');
      const status = rawVal || '';
      badge.textContent = status;
      badge.className   = `status-badge ${status}`;
      // Badge for Failed gets an additional at-rest glow class
      badge.classList.toggle('badge-failed-glow', status === 'Failed');

    } else if (col.key === 'roi_percent') {
      const span = cell.querySelector('[data-role="roi-value"]');
      const n    = Number(rawVal);
      span.textContent = formatPercent(rawVal);
      cell.classList.toggle('positive-roi', isFinite(n) && n >= 0);
      cell.classList.toggle('negative-roi', isFinite(n) && n < 0);

    } else if (col.format === 'currency') {
      const text = formatCurrency(rawVal);
      if (cell.textContent !== text) cell.textContent = text;

      // High-savings highlight (Part B — guide eye to standout numbers)
      if (col.key === 'annual_savings_usd') {
        cell.classList.toggle('high-savings', Number(rawVal) >= HIGH_SAVINGS_THRESHOLD);
      }

    } else if (col.format === 'number') {
      const text = formatNumber(rawVal);
      if (cell.textContent !== text) cell.textContent = text;

    } else {
      // Plain string
      const text = rawVal != null ? String(rawVal) : '';
      if (cell.textContent !== text) cell.textContent = text;

      // Bug #1 fix: set title for truncatable columns so hover reveals full value
      if (TRUNCATABLE_KEYS.has(col.key)) {
        if (cell.title !== text) cell.title = text;
      }
    }
  }
}
