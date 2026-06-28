/**
 * App.jsx — Composition root and stream orchestrator
 *
 * Data flow:
 *   window.initializeRpaStream → processBatch() → rpaStore
 *     → subscriber notified → viewEngine.computeView() (throttled via rAF)
 *     → viewArrayRef.current updated → gridRef._rpaRefresh() called
 *
 * React state is minimized:
 *   • kpiTotals    — updates every tick for KPI strip
 *   • isPaused     — structural: affects visual state of several components
 *   • sortKeys     — structural: triggers view recompute
 *   • filters      — structural: triggers view recompute
 *   • searchQuery  — structural: triggers view recompute
 *   • layout       — structural: controls panel visibility
 *   • totalRows    — for spacer height + row count badge
 *   • filterOptions — derived once from store, updated throttled
 *
 * The grid itself NEVER re-renders from stream ticks — only from structural changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

import { processBatch, subscribe, pause, play, getStore, getKpiTotals, getIsPaused } from './state/rpaStore.js';
import { computeView, getDistinctValues } from './state/viewEngine.js';
import { computeAggregates } from './utils/aggregates.js';

import TitleBar             from './components/TitleBar.jsx';
import KpiStrip             from './components/KpiStrip.jsx';
import ControlBar           from './components/ControlBar.jsx';
import VirtualizedGrid      from './components/VirtualizedGrid.jsx';
import LayoutPanelToggle    from './components/LayoutPanelToggle.jsx';
import DeptChart            from './components/DeptChart.jsx';
import RowInspector         from './components/RowInspector.jsx';
import AnalyticsDashboard   from './components/AnalyticsDashboard.jsx';
import { readLayout, writeLayout } from './utils/layout.js';

// CSV URL — must match what's in /public/
const CSV_URL = '/rpa_database_2026.csv';

export default function App() {
  // ─── React state (structural only) ─────────────────────────────────────────
  const [kpiTotals,     setKpiTotals]     = useState({ totalRowsProcessed: 0, cumulativeRobots: 0, cumulativeAnnualSavings: 0 });
  const [isPaused,      setIsPaused]      = useState(false);
  const [sortKeys,      setSortKeys]      = useState([]);   // { field, dir }[]
  const [filters,       setFilters]       = useState({});   // { field: Set<string> }
  const [searchQuery,   setSearchQuery]   = useState('');
  const [layout,        setLayout]        = useState(() => readLayout());
  const [totalRows,     setTotalRows]     = useState(0);
  const [filterOptions, setFilterOptions] = useState({});
  const [chartTick,     setChartTick]     = useState(0);
  // Inspector: the selected row object or null (closed)
  const [inspectedRow,  setInspectedRow]  = useState(null);
  // Analytics Dashboard: open state
  const [isAnalyticsOpen, setAnalyticsOpen] = useState(false);

  // Cached aggregates — computed lazily on first inspector open, then
  // reused until store size changes. Stored in a ref so updates don't
  // trigger re-renders of anything.
  const aggregatesRef = useRef(null);

  // ─── Refs ───────────────────────────────────────────────────────────────────
  // viewArrayRef holds the current computed view — read directly by VirtualizedGrid
  // and DeptChart without triggering React renders
  const viewArrayRef    = useRef([]);
  const gridRef         = useRef(null);      // ref to VirtualizedGrid scroll container
  const criteriaRef     = useRef({           // current pipeline criteria — updated synchronously
    filters: {}, searchQuery: '', sortKeys: []
  });
  const recomputeRafRef = useRef(null);

  // ─── View recompute (throttled, max once per rAF tick) ──────────────────────

  const scheduleRecompute = useCallback(() => {
    if (recomputeRafRef.current) return;
    recomputeRafRef.current = requestAnimationFrame(() => {
      recomputeRafRef.current = null;

      const store = getStore();
      const view  = computeView(store, criteriaRef.current);
      viewArrayRef.current = view;

      setTotalRows(view.length);

      // Tell the grid to re-render its visible window
      const container = gridRef.current;
      if (container && container._rpaRefresh) {
        container._rpaRefresh();
      }
    });
  }, []);

  // ─── Store subscriber ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribe(({ kpiOnly }) => {
      // Always update KPI totals (even when paused)
      setKpiTotals({ ...getKpiTotals() });

      // Grid recompute only when not paused
      if (!kpiOnly) {
        scheduleRecompute();
      }
    });

    return unsub;
  }, [scheduleRecompute]);

  // ─── Stream initialization — registered exactly once ────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || !window.initializeRpaStream) {
      console.warn('[App] dataStream.js not loaded — ensure <script src="/dataStream.js"> is in index.html');
      return;
    }

    window.initializeRpaStream(processBatch, CSV_URL);

    // Populate filter options once the CSV loads (delayed 1s to let store fill)
    const optTimer = setTimeout(() => {
      const store = getStore();
      if (store.size === 0) return;
      const fields = ['automation_type', 'department', 'industry', 'country'];
      const opts = {};
      fields.forEach(f => { opts[f] = getDistinctValues(store, f); });
      setFilterOptions(opts);
      scheduleRecompute();
    }, 1200);

    return () => clearTimeout(optTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh filter options periodically (every 30s) in case new values stream in
  useEffect(() => {
    const id = setInterval(() => {
      const store = getStore();
      if (store.size === 0) return;
      const fields = ['automation_type', 'department', 'industry', 'country'];
      const opts = {};
      fields.forEach(f => { opts[f] = getDistinctValues(store, f); });
      setFilterOptions(prev => {
        // Only update state if something actually changed
        const changed = fields.some(f => {
          const a = opts[f], b = prev[f];
          return !b || a.length !== b.length;
        });
        return changed ? opts : prev;
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Throttle chart redraws — update every 2s max
  useEffect(() => {
    const id = setInterval(() => setChartTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // ─── Sort handler ────────────────────────────────────────────────────────────

  const handleSort = useCallback((field, isShift) => {
    setSortKeys(prev => {
      let next;
      const existingIdx = prev.findIndex(k => k.field === field);

      if (!isShift) {
        // Single sort: toggle direction or set new
        if (existingIdx !== -1 && prev.length === 1) {
          // Toggle direction
          next = [{ field, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }];
        } else {
          next = [{ field, dir: 'asc' }];
        }
      } else {
        // Multi-sort: add/toggle/remove
        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          if (existing.dir === 'asc') {
            // Toggle to desc
            next = prev.map((k, i) => i === existingIdx ? { ...k, dir: 'desc' } : k);
          } else {
            // Remove this key
            next = prev.filter((_, i) => i !== existingIdx);
          }
        } else {
          next = [...prev, { field, dir: 'asc' }];
        }
      }

      criteriaRef.current = { ...criteriaRef.current, sortKeys: next };
      scheduleRecompute();
      return next;
    });
  }, [scheduleRecompute]);

  // ─── Filter handler ──────────────────────────────────────────────────────────

  const handleFilter = useCallback((field, newSet) => {
    setFilters(prev => {
      const next = { ...prev, [field]: newSet };
      criteriaRef.current = { ...criteriaRef.current, filters: next };
      scheduleRecompute();
      return next;
    });
  }, [scheduleRecompute]);

  // ─── Search handler ──────────────────────────────────────────────────────────

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    criteriaRef.current = { ...criteriaRef.current, searchQuery: query };
    scheduleRecompute();
  }, [scheduleRecompute]);

  // ─── Pause/Play ──────────────────────────────────────────────────────────────

  // Row inspector: stable callbacks (no deps that change identity)
  const handleRowClick = useCallback((rowId) => {
    // Hard gate: do nothing if stream is live (belt-and-suspenders over the
    // isPausedRef check already in VirtualizedGrid)
    if (!getIsPaused()) return;
    const row = getStore().get(rowId);
    if (!row) return;
    // Compute aggregates lazily — cached by store size in the module
    aggregatesRef.current = computeAggregates(getStore());
    setInspectedRow(row);
  }, []); // stable — getIsPaused/getStore are module-level, not closured

  const handleCloseInspector = useCallback(() => {
    setInspectedRow(null);
  }, []);

  const handleToggleAnalytics = useCallback(() => {
    if (!getIsPaused()) return;
    setAnalyticsOpen(prev => !prev);
  }, []);

  const handlePauseToggle = useCallback(() => {
    const nowPaused = !getIsPaused();
    if (nowPaused) {
      pause();
      setIsPaused(true);
    } else {
      play();
      setIsPaused(false);
      setInspectedRow(null); // close inspector on resume — stale data when live
      setAnalyticsOpen(false); // also close analytics
      // play() fires a full notify, which triggers scheduleRecompute via subscriber
    }
  }, []);

  // ─── Export ──────────────────────────────────────────────────────────────────

  const handleSnapshotExport = useCallback(() => {
    const data = viewArrayRef.current;
    console.log("Snapshot export triggered. Data length:", data ? data.length : 0);
    if (!data || data.length === 0) return;

    const fields = [
      'project_id', 'company_id', 'project_name', 'start_date',
      'completion_date', 'project_status', 'automation_type', 'robots_deployed',
      'budget_usd', 'annual_savings_usd', 'roi_percent', 'department',
      'implementation_partner', 'country', 'industry', 'employee_hours_saved',
      'ai_enabled', 'cloud_deployment'
    ];

    const rows = [fields.join(',')];
    let i = 0;
    const chunkSize = 2000;

    function processChunk() {
      const end = Math.min(i + chunkSize, data.length);
      for (; i < end; i++) {
        const row = data[i];
        const rowStr = fields.map(f => {
          let val = row[f];
          if (val == null) return '';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          
          let str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        rows.push(rowStr);
      }
      
      if (i < data.length) {
        setTimeout(processChunk, 0);
      } else {
        const csv = rows.join('\n');
        console.log("CSV generated length:", csv.length);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const ts = `${y}-${m}-${d}-${h}-${min}-${s}`;
        
        link.setAttribute('download', `rpa-snapshot-${ts}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Increase timeout to 60s to ensure the download completes even if a 'Save As' dialog is shown.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    }
    
    processChunk();
  }, []);

  // ─── Layout persistence ──────────────────────────────────────────────────────

  const handleLayoutToggle = useCallback((key, visible) => {
    setLayout(prev => {
      const next = { ...prev, [key]: visible };
      writeLayout(next);
      return next;
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* 0. Title Bar */}
      <TitleBar isPaused={isPaused} />

      {/* 1. KPI Strip */}
      <KpiStrip totals={kpiTotals} isPaused={isPaused} />

      {/* 2. Control Bar */}
      <ControlBar
        isPaused={isPaused}
        onPauseToggle={handlePauseToggle}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        filters={filters}
        filterOptions={filterOptions}
        onFilter={handleFilter}
        visibleCount={totalRows}
        totalCount={getStore().size}
        isAnalyticsOpen={isAnalyticsOpen}
        onAnalyticsToggle={handleToggleAnalytics}
        onSnapshotExport={handleSnapshotExport}
      />

      {/* 3. Layout Toggle */}
      <LayoutPanelToggle layout={layout} onToggle={handleLayoutToggle} />

      {/* 4. Main content area */}
      <div className="main-area">
        <div className="panels-container">
          {/* Grid panel */}
          {layout.grid !== false && (
            <VirtualizedGrid
              ref={gridRef}
              viewArrayRef={viewArrayRef}
              totalRows={totalRows}
              sortKeys={sortKeys}
              onSort={handleSort}
              isPaused={isPaused}
              onRowClick={handleRowClick}
            />
          )}

          {/* Department chart panel */}
          {layout.chart !== false && (
            <DeptChart viewArrayRef={viewArrayRef} triggerCount={chartTick} />
          )}
        </div>
      </div>

      {/* Paused overlay indicator */}
      {isPaused && (
        <div className="paused-overlay" role="status" aria-live="assertive">
          <span>⏸</span>
          STREAM PAUSED — CLICK ROW TO INSPECT
        </div>
      )}

      {/* Row inspector panel — only mounts when paused AND a row is selected */}
      {inspectedRow && (
        <RowInspector
          row={inspectedRow}
          aggregates={aggregatesRef.current}
          onClose={handleCloseInspector}
        />
      )}

      {/* Analytics overlay — only mounts when paused AND toggled open */}
      {isPaused && isAnalyticsOpen && (
        <AnalyticsDashboard onClose={() => setAnalyticsOpen(false)} />
      )}
    </div>
  );
}
