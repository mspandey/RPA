/**
 * SortableHeader.jsx — Column header with single + multi-sort support
 *
 * Features:
 *   • Click → single sort on this column (toggles asc/desc)
 *   • Shift+click → add as secondary (or higher) sort key
 *   • Numbered priority badge when part of multi-sort
 *   • aria-sort on active column, keyboard accessible (Enter/Space)
 */

import { memo, useCallback } from 'react';

const SortableHeader = memo(function SortableHeader({
  field, label, className, sortKeys, onSort
}) {
  // Find this column's current position in sortKeys
  const sortIndex = sortKeys.findIndex(k => k.field === field);
  const isActive  = sortIndex !== -1;
  const direction = isActive ? sortKeys[sortIndex].dir : null;
  const priority  = isActive ? sortIndex + 1 : null; // 1-indexed badge

  const ariaSortVal = !isActive ? 'none'
    : direction === 'asc' ? 'ascending' : 'descending';

  const handleClick = useCallback((e) => {
    onSort(field, e.shiftKey);
  }, [field, onSort]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(field, e.shiftKey);
    }
  }, [field, onSort]);

  return (
    <button
      className={`col-header ${className}${isActive ? ' sorted' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-sort={ariaSortVal}
      title={`Sort by ${label}${isActive ? ` (${direction})` : ''} — Shift+click for multi-sort`}
    >
      <span>{label}</span>

      {isActive && (
        <span
          className="sort-arrow"
          aria-hidden="true"
          style={{ transform: direction === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          ↑
        </span>
      )}

      {priority !== null && sortKeys.length > 1 && (
        <span className="sort-badge" aria-label={`Sort priority ${priority}`}>
          {priority}
        </span>
      )}
    </button>
  );
});

export default SortableHeader;
