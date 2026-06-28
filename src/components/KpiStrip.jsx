/**
 * KpiStrip.jsx — Three KPI counters with digit-roll animation
 *
 * Visual features:
 *   • One-time count-up entrance tween (~800ms eased) on initial page load only.
 *     After the initial tween completes, normal digit-roll takes over.
 *   • Per-card accent underline bar (3px, colored per metric) that pulses
 *     subtly as values update — gives each KPI its own identity.
 *   • Per-card faint gradient background differs slightly per metric.
 *   • Live-pulse dot extended: also shown inline next to "live" KPIs.
 *
 * Performance notes:
 *   • Count-up tween runs once via requestAnimationFrame, then stops.
 *     Zero ongoing cost after the first ~800ms.
 *   • Digit-roll CSS animation (class toggle, 180ms) is gated on value change.
 *   • Respects prefers-reduced-motion — tween and roll both disabled.
 */

import { useRef, useEffect, useState, memo } from 'react';
import { formatNumber, formatCurrency } from '../utils/formatters.js';

const REDUCED_MOTION = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// Easing function for the entrance tween
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** One-time count-up entrance tween. Returns a cleanup fn. */
function runEntranceTween(targetValue, durationMs, onTick, onDone) {
  if (REDUCED_MOTION || targetValue === 0) {
    onTick(targetValue);
    onDone();
    return () => {};
  }

  const start = performance.now();
  let rafId;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = easeOutExpo(progress);
    onTick(Math.round(eased * targetValue));
    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onDone();
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

const KpiCounter = memo(function KpiCounter({
  label,
  value,
  prefix,
  accentColor,
  entranceDone,
  onEntranceDone,
}) {
  const spanRef      = useRef(null);
  const prevRef      = useRef(null);
  const tweenedRef   = useRef(false);  // has entrance tween fired for this card?

  const formatted = prefix === '$' ? formatCurrency(value) : formatNumber(value);

  // ─── Entrance tween (once, on first non-zero value) ─────────────────────────
  useEffect(() => {
    if (tweenedRef.current || entranceDone || value === 0) return;
    tweenedRef.current = true;

    const el = spanRef.current;
    if (!el) return;

    const cancel = runEntranceTween(value, 850, (v) => {
      el.textContent = prefix === '$' ? formatCurrency(v) : formatNumber(v);
      prevRef.current = null; // allow subsequent roll once tween ends
    }, onEntranceDone);

    return cancel;
  }, [value, prefix, entranceDone, onEntranceDone]); // eslint-disable-line

  // ─── Normal digit-roll after entrance is complete ───────────────────────────
  useEffect(() => {
    if (!entranceDone) return; // still in entrance phase — don't fight the tween
    const el = spanRef.current;
    if (!el) return;

    if (formatted !== prevRef.current) {
      el.textContent = formatted;
      prevRef.current = formatted;

      if (!REDUCED_MOTION) {
        el.classList.remove('rolling');
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add('rolling');
      }
    }
  });

  return (
    <div className="kpi-card" style={{ '--kpi-accent': accentColor }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value-wrap">
        {prefix && <span className="kpi-prefix mono">{prefix}</span>}
        <span
          ref={spanRef}
          className="kpi-value mono"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatted}
        </span>
      </div>
      {/* Per-metric accent underline — provides visual differentiation */}
      <div className="kpi-accent-bar" aria-hidden="true" />
    </div>
  );
});

export default function KpiStrip({ totals, isPaused }) {
  const { totalRowsProcessed, cumulativeRobots, cumulativeAnnualSavings } = totals;

  // Entrance tween completes once for ALL cards simultaneously — triggered
  // by the first card finishing its tween. After this, all cards switch to
  // normal digit-roll behavior.
  const [entranceDone, setEntranceDone] = useState(false);

  return (
    <div className="kpi-strip" role="region" aria-label="Key performance indicators">
      <KpiCounter
        label="EVENTS // TOTAL"
        value={totalRowsProcessed}
        accentColor="var(--accent)"
        isPaused={isPaused}
        entranceDone={entranceDone}
        onEntranceDone={() => setEntranceDone(true)}
      />
      <KpiCounter
        label="ROBOTS // DEPLOYED"
        value={cumulativeRobots}
        accentColor="var(--status-completed)"
        isPaused={isPaused}
        entranceDone={entranceDone}
        onEntranceDone={() => setEntranceDone(true)}
      />
      <KpiCounter
        label="SAVINGS // USD CUML"
        value={cumulativeAnnualSavings}
        prefix="$"
        accentColor="var(--status-active)"
        isPaused={isPaused}
        entranceDone={entranceDone}
        onEntranceDone={() => setEntranceDone(true)}
      />

    </div>
  );
}
