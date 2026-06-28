/**
 * layout.js — layout configuration and localStorage utilities
 */

const STORAGE_KEY = 'rpa-layout';

export const PANELS = [
  { key: 'grid',  label: 'DATA // GRID' },
  { key: 'chart', label: 'DEPT // CHART' },
];

/** Read persisted layout from localStorage. */
export function readLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all known panels have a value
      const defaults = Object.fromEntries(PANELS.map(p => [p.key, true]));
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return Object.fromEntries(PANELS.map(p => [p.key, true]));
}

/** Write layout to localStorage. */
export function writeLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}
