/**
 * RowInspector.jsx — Pause-gated detailed row inspector panel.
 *
 * Renders as a fixed-position slide-in panel from the right edge.
 * Only mounts when the parent (App.jsx) has both isPaused === true
 * AND a selected row — the parent enforces the gate, not this component.
 *
 * Displays all 18 CSV fields grouped by section, plus 3 relational
 * comparison data points computed from the cached aggregates.
 *
 * Performance contract:
 *   • This component is isolated via a fixed overlay — the grid beneath
 *     never re-renders or reflows when this mounts/unmounts.
 *   • All formatting reuses the shared formatters.js utilities.
 *   • Aggregates are passed in as a prop (computed + cached by App.jsx
 *     on first open) — zero per-click computation in here.
 */

import { useEffect, useCallback } from 'react';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters.js';
import { percentileRank } from '../utils/aggregates.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(val) {
  if (!val) return '—';
  // Dates arrive as "YYYY-MM-DD" strings from the CSV
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBool(val) {
  if (val === true  || val === 'true'  || val === 1 || val === '1' || val === 'Yes') return 'YES';
  if (val === false || val === 'false' || val === 0 || val === '0' || val === 'No')  return 'NO';
  return String(val ?? '—').toUpperCase();
}

function SignDelta({ delta }) {
  const sign  = delta >= 0 ? '+' : '';
  const color = delta >= 0 ? 'var(--status-active)' : 'var(--alert)';
  return (
    <span style={{ color, fontWeight: 700 }}>
      {sign}{delta.toFixed(1)}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div className="insp-section-header">
      <span className="insp-section-label">{label}</span>
    </div>
  );
}

function Field({ label, value, valueClass = '' }) {
  return (
    <div className="insp-field">
      <span className="insp-field-label">{label}</span>
      <span className={`insp-field-value${valueClass ? ' ' + valueClass : ''}`}>{value}</span>
    </div>
  );
}

function RelationalRow({ label, children }) {
  return (
    <div className="insp-relational-row">
      <span className="insp-relational-label">{label}</span>
      <span className="insp-relational-value">{children}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @param {{ row: Object, aggregates: Object, onClose: Function }} props
 */
export default function RowInspector({ row, aggregates, onClose }) {
  // ── Escape key handler ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!row) return null;

  // ── Status styling (reuses same badge classes as GridRow) ─────────────────
  const status = row.project_status || '';

  // ── ROI formatting with positive/negative class ───────────────────────────
  const roiNum    = Number(row.roi_percent);
  const roiFormatted = formatPercent(row.roi_percent);
  const roiClass  = isFinite(roiNum) ? (roiNum >= 0 ? 'positive-roi' : 'negative-roi') : '';

  // ── Relational context computations ──────────────────────────────────────
  let roiDelta         = null;
  let deptAvgROI       = null;
  let budgetPercentile = null;
  let hoursDelta       = null;
  let autoAvgHours     = null;

  if (aggregates) {
    const dept  = String(row.department     || '').trim();
    const ind   = String(row.industry       || '').trim();
    const atype = String(row.automation_type || '').trim();

    // 1. ROI vs department average
    if (dept && aggregates.deptROI.has(dept) && isFinite(roiNum)) {
      deptAvgROI = aggregates.deptROI.get(dept);
      roiDelta   = roiNum - deptAvgROI;
    }

    // 2. Budget percentile within industry
    const indBudgets = aggregates.industryBudgets.get(ind);
    const budgetNum  = Number(row.budget_usd);
    if (indBudgets && isFinite(budgetNum)) {
      budgetPercentile = percentileRank(indBudgets, budgetNum);
    }

    // 3. Employee hours saved vs automation type average
    const hoursNum = Number(row.employee_hours_saved);
    if (atype && aggregates.automationHours.has(atype) && isFinite(hoursNum)) {
      autoAvgHours = aggregates.automationHours.get(atype);
      hoursDelta   = hoursNum - autoAvgHours;
    }
  }

  return (
    <>
      {/* Backdrop — click outside closes */}
      <div
        className="insp-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="insp-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Inspector: ${row.project_name || row.project_id}`}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="insp-header">
          <div className="insp-header-id">{row.project_id}</div>
          <div className="insp-header-name">{row.project_name || '—'}</div>
          <div className="insp-header-status">
            <span className={`status-badge ${status}`}>{status}</span>
            <span className="insp-header-hint">// PAUSED STREAM · INSPECTOR ACTIVE</span>
          </div>
          <button
            className="insp-close-btn"
            aria-label="Close inspector"
            onClick={onClose}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="insp-body">

          {/* IDENTITY */}
          <SectionHeader label="IDENTITY // PROJECT" />
          <div className="insp-fields-group">
            <Field label="PRJ // ID"      value={row.project_id    || '—'} />
            <Field label="CO // ID"       value={row.company_id    || '—'} />
            <Field label="PRJ // NAME"    value={row.project_name  || '—'} />
          </div>

          {/* TIMELINE */}
          <SectionHeader label="TIMELINE // DATES" />
          <div className="insp-fields-group">
            <Field label="START // DATE"  value={formatDate(row.start_date)} />
            <Field label="END // DATE"    value={formatDate(row.completion_date)} />
          </div>

          {/* FINANCIALS */}
          <SectionHeader label="FINANCIALS // USD" />
          <div className="insp-fields-group">
            <Field
              label="BUDGET // USD"
              value={formatCurrency(row.budget_usd)}
              valueClass="currency"
            />
            <Field
              label="SAVINGS // USD"
              value={formatCurrency(row.annual_savings_usd)}
              valueClass={Number(row.annual_savings_usd) >= 3_000_000 ? 'high-savings' : 'currency'}
            />
            <Field
              label="ROI // PCT"
              value={roiFormatted}
              valueClass={roiClass}
            />
          </div>

          {/* OPERATIONS */}
          <SectionHeader label="OPERATIONS // TECH" />
          <div className="insp-fields-group">
            <Field label="AUTO // TYPE"   value={row.automation_type      || '—'} />
            <Field label="ROBOTS // QTY"  value={formatNumber(row.robots_deployed)} valueClass="numeric" />
            <Field label="HOURS // SAVED" value={formatNumber(row.employee_hours_saved)} valueClass="numeric" />
            <Field label="DEPT // LOC"    value={row.department            || '—'} />
          </div>

          {/* CONTEXT */}
          <SectionHeader label="CONTEXT // ENV" />
          <div className="insp-fields-group">
            <Field label="GEO // LOC"     value={row.country               || '—'} />
            <Field label="IND // SEC"     value={row.industry              || '—'} />
            <Field label="PARTNER // IMPL" value={row.implementation_partner || '—'} />
            <Field label="AI // ENABLED"  value={formatBool(row.ai_enabled)} />
            <Field label="CLOUD // DEPLOY" value={formatBool(row.cloud_deployment)} />
          </div>

          {/* RELATIONAL CONTEXT — only if aggregates available */}
          {aggregates && (
            <>
              <SectionHeader label="SIGNAL // RELATIONAL CONTEXT" />
              <div className="insp-relational-block">

                {/* 1. ROI vs dept average */}
                {deptAvgROI !== null && (
                  <RelationalRow label="ROI // vs DEPT AVG">
                    {roiFormatted}
                    {' '}·{' '}
                    <SignDelta delta={roiDelta} />
                    {' pts vs '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {row.department} avg {formatPercent(deptAvgROI)}
                    </span>
                  </RelationalRow>
                )}

                {/* 2. Budget percentile within industry */}
                {budgetPercentile !== null && (
                  <RelationalRow label="BUDGET // INDUSTRY RANK">
                    <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>
                      P{budgetPercentile}
                    </span>
                    {' — '}
                    {formatCurrency(row.budget_usd)} in {row.industry}
                    {' ('}
                    {budgetPercentile < 33 ? 'low-budget tier'
                      : budgetPercentile < 67 ? 'mid-budget tier'
                      : 'high-budget tier'}
                    {')'}
                  </RelationalRow>
                )}

                {/* 3. Employee hours vs automation type average */}
                {autoAvgHours !== null && (
                  <RelationalRow label="HOURS // vs TYPE AVG">
                    {formatNumber(row.employee_hours_saved)}
                    {' hrs '}·{' '}
                    <SignDelta delta={hoursDelta} />
                    {' vs '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {row.automation_type} avg {formatNumber(autoAvgHours)} hrs
                    </span>
                  </RelationalRow>
                )}

                {/* Fallback if none computed yet */}
                {deptAvgROI === null && budgetPercentile === null && autoAvgHours === null && (
                  <div className="insp-relational-pending">
                    // Insufficient data — stream still populating
                  </div>
                )}
              </div>
            </>
          )}

        </div>{/* end insp-body */}
      </aside>
    </>
  );
}
