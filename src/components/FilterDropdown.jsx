/**
 * FilterDropdown.jsx — Multi-select categorical filter
 *
 * Logic:
 *   • Renders a button that opens/closes a popover with checkboxes.
 *   • "Selected" is a Set<string> passed in as prop.
 *   • onChange(newSet) bubbles up to App, which rebuilds viewEngine criteria.
 *   • Shows a count badge when any filters are active.
 *   • Closes on outside click (via document mousedown listener).
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';

const FilterDropdown = memo(function FilterDropdown({
  _field, label, options, selected, onChange
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOption = useCallback((val) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(next);
  }, [selected, onChange]);

  const clearAll = useCallback((e) => {
    e.stopPropagation();
    onChange(new Set());
  }, [onChange]);

  const count = selected.size;

  return (
    <div className="filter-wrap" ref={wrapRef}>
      <button
        className={`filter-btn${open ? ' active' : ''}${count > 0 ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`Filter by ${label}`}
      >
        {label}
        {count > 0 && (
          <span className="filter-count">{count}</span>
        )}
        <span aria-hidden="true" style={{ fontSize: '9px', marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div className="filter-popover" role="listbox" aria-multiselectable="true" aria-label={`${label} filter options`}>
          <div className="filter-popover-header">
            {label}
            {count > 0 && (
              <button className="filter-clear" onClick={clearAll} title="Clear all">
                Clear
              </button>
            )}
          </div>
          {options.map(opt => (
            <label key={opt} className="filter-option" role="option" aria-selected={selected.has(opt)}>
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggleOption(opt)}
              />
              <span>{opt || '(empty)'}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});

export default FilterDropdown;
