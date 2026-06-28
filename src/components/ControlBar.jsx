/**
 * ControlBar.jsx — Pause/Play + Search + Filter dropdowns
 *
 * Owns:
 *   • Pause/Play button with aria-pressed + descriptive label
 *   • Search input with 120ms debounce
 *   • FilterDropdown instances for automation_type, department, industry, country
 *   • Visible row count badge
 */

import { memo, useCallback, useRef } from 'react';
import FilterDropdown from './FilterDropdown.jsx';

const FILTER_FIELDS = [
  { field: 'automation_type', label: 'AUTO // TYPE' },
  { field: 'department',      label: 'DEPT // LOC' },
  { field: 'industry',        label: 'IND // SEC' },
  { field: 'country',         label: 'GEO // LOC' },
];

const ControlBar = memo(function ControlBar({
  isPaused,
  onPauseToggle,
  searchQuery,
  onSearch,
  filters,
  filterOptions,
  onFilter,
  visibleCount,
  totalCount,
  isAnalyticsOpen,
  onAnalyticsToggle,
  onSnapshotExport,
}) {
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(val);
    }, 120);
  }, [onSearch]);

  return (
    <div className="control-bar" role="toolbar" aria-label="Grid controls">
      {/* Pause / Play */}
      <button
        className="pause-btn"
        onClick={onPauseToggle}
        aria-pressed={isPaused}
        aria-label={isPaused ? 'Resume live stream' : 'Pause live stream'}
        title={isPaused ? 'Resume live stream (data buffered)' : 'Pause live stream'}
      >
        <span className="btn-dot" aria-hidden="true" />
        {isPaused ? '▶ RUN' : '⏸ HALT'}
      </button>

      <div className="control-divider" aria-hidden="true" />

      {/* Analytics Toggle */}
      <button
        className="analytics-btn"
        onClick={onAnalyticsToggle}
        disabled={!isPaused}
        aria-pressed={isAnalyticsOpen}
        title={!isPaused ? 'Pause stream to view analytics' : 'Toggle analytics overlay'}
        style={{
          background: 'var(--bg-panel)',
          color: !isPaused ? 'var(--text-dim)' : (isAnalyticsOpen ? 'var(--accent-amber)' : 'var(--text-main)'),
          border: '1px solid var(--border-color)',
          padding: '0 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          cursor: !isPaused ? 'not-allowed' : 'pointer',
          opacity: !isPaused ? 0.5 : 1,
          height: '24px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        ANALYTICS // OVERLAY
      </button>

      <div className="control-divider" aria-hidden="true" />

      {/* Snapshot Export */}
      <button
        className="analytics-btn"
        onClick={onSnapshotExport}
        disabled={!isPaused}
        title={!isPaused ? 'Pause stream to export snapshot' : 'Export current view to CSV'}
        style={{
          background: 'var(--bg-panel)',
          color: !isPaused ? 'var(--text-dim)' : 'var(--accent-amber)',
          border: '1px solid var(--border-color)',
          padding: '0 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          cursor: !isPaused ? 'not-allowed' : 'pointer',
          opacity: !isPaused ? 0.5 : 1,
          height: '24px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        EXPORT // SNAPSHOT
      </button>

      <div className="control-divider" aria-hidden="true" />

      {/* Search */}
      <input
        className="search-input"
        type="search"
        defaultValue={searchQuery}
        onChange={handleSearchChange}
        placeholder="QUERY // TARGET..."
        aria-label="Fuzzy search across project fields"
        autoComplete="off"
        spellCheck={false}
      />

      <div className="control-divider" aria-hidden="true" />

      {/* Filters */}
      {FILTER_FIELDS.map(({ field, label }) => (
        <FilterDropdown
          key={field}
          field={field}
          label={label}
          options={filterOptions[field] || []}
          selected={filters[field] || new Set()}
          onChange={(newSet) => onFilter(field, newSet)}
        />
      ))}

      <div className="control-divider" aria-hidden="true" />

      {/* Row count — shows filtered view size, NOT the stream counter (see KPI strip) */}
      <span className="row-count-badge" aria-live="polite" aria-atomic="true" title="Rows visible in current filtered view vs. total dataset">
        <span className="row-count-label">FILTER // SET: </span>
        <strong>{visibleCount.toLocaleString()}</strong>
        <span className="row-count-label"> / </span>
        {totalCount.toLocaleString()}
      </span>
    </div>
  );
});

export default ControlBar;
