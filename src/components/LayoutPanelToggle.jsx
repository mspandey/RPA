/**
 * LayoutPanelToggle.jsx — Show/hide widget checkboxes with localStorage persistence
 *
 * Reads visibility state from localStorage on mount.
 * Writes to localStorage on every toggle.
 * Exposes an onChange(key, visible) callback so App can conditionally render panels.
 */

import { memo } from 'react';

import { PANELS } from '../utils/layout.js';


const LayoutPanelToggle = memo(function LayoutPanelToggle({ layout, onToggle }) {
  return (
    <div className="layout-toggle-bar" role="group" aria-label="Panel visibility">
      <span className="layout-toggle-label">PANEL // TOGGLES:</span>
      {PANELS.map(({ key, label }) => (
        <label key={key} className="toggle-item">
          <input
            type="checkbox"
            checked={layout[key] ?? true}
            onChange={e => onToggle(key, e.target.checked)}
            aria-label={`Show ${label} panel`}
          />
          {label}
        </label>
      ))}
    </div>
  );
});

export default LayoutPanelToggle;
