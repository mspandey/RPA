/**
 * VirtualizedGrid.jsx — Hand-rolled row-recycling virtualized grid
 *
 * Performance strategy:
 *   • Fixed pool of N DOM row nodes (Math.ceil(viewportH / rowH) + OVERSCAN).
 *     Nodes are created once; their content is mutated in place on every update.
 *   • Scroll: a single scroll listener sets a dirty flag + pending start index.
 *     The actual DOM writes happen inside a requestAnimationFrame loop
 *     (never in the scroll handler itself).
 *   • Stream ticks: when viewArray ref changes (after rAF-gated recompute),
 *     we call renderViewport() which directly mutates the visible pool nodes.
 *     No React state change → no React re-render at tick rate.
 *   • React state is only touched for structural changes:
 *     viewport resize (pool needs rebuild) and totalRows change (spacer height).
 *
 * Node lifecycle:
 *   createRowElement()  → called once per pool slot on mount / resize
 *   updateRowElement()  → called on every scroll + every stream tick
 *   destroy             → never (nodes recycled indefinitely)
 */

import { useRef, useEffect, useCallback, forwardRef, memo } from 'react';
import { createRowElement, updateRowElement, COLUMNS } from './GridRow.js';
import SortableHeader from './SortableHeader.jsx';

const ROW_HEIGHT = 36;
const OVERSCAN   = 5;

const VirtualizedGrid = memo(forwardRef(function VirtualizedGrid({ viewArrayRef, totalRows, sortKeys, onSort, isPaused, onRowClick }, ref) {
  const containerRef   = useRef(null);  // scroll container
  const spacerRef      = useRef(null);  // height proxy
  const poolLayerRef   = useRef(null);  // absolute inner layer holding all row nodes
  const rowPoolRef     = useRef([]);    // array of row DOM elements
  const startIndexRef  = useRef(0);     // currently rendered start index
  const pendingIndexRef = useRef(0);    // start index from last scroll event
  const dirtyRef       = useRef(false); // rAF dirty flag
  const rafRef         = useRef(null);  // rAF handle
  const poolSizeRef    = useRef(0);     // current pool capacity
  // Ref mirror of isPaused — read synchronously in the click handler without
  // creating a stale closure. This avoids needing isPaused as a dep of the
  // click callback, which would recreate the handler on every pause toggle.
  const isPausedRef    = useRef(isPaused);
  isPausedRef.current  = isPaused;
  // ─── Pool initialization / rebuild on resize ────────────────────────────────
  
  const buildPool = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
  
    const viewportH  = container.clientHeight;
    const needed     = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN;
  
    // Only rebuild if pool size changed
    if (needed === poolSizeRef.current) return;
    poolSizeRef.current = needed;
  
    // Clear old nodes
    const layer = poolLayerRef.current;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    rowPoolRef.current = [];
  
    // Create new pool
    for (let i = 0; i < needed; i++) {
      const el = createRowElement(i);
      layer.appendChild(el);
      rowPoolRef.current.push(el);
    }
  }, []);
  
  // ─── Render the visible viewport ────────────────────────────────────────────
  
  const renderViewport = useCallback((startIdx) => {
    const pool    = rowPoolRef.current;
    const view    = viewArrayRef.current;
    const poolLen = pool.length;
    if (!poolLen || !view) return;
  
    startIndexRef.current = startIdx;
  
    for (let i = 0; i < poolLen; i++) {
      const dataIdx = startIdx + i;
      const row     = dataIdx < view.length ? view[dataIdx] : null;
      updateRowElement(pool[i], row, dataIdx);
    }
  }, [viewArrayRef]);
  
  // ─── rAF loop ───────────────────────────────────────────────────────────────
  
  const rafLoop = useCallback(() => {
    if (dirtyRef.current) {
      const newStart = pendingIndexRef.current;
      if (newStart !== startIndexRef.current) {
        renderViewport(newStart);
      }
      dirtyRef.current = false;
    }
    rafRef.current = requestAnimationFrame(rafLoop);
  }, [renderViewport]);
  
  // ─── Scroll handler — only sets dirty + pending, no DOM writes ──────────────
  
  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rawStart = Math.floor(container.scrollTop / ROW_HEIGHT);
    const view = viewArrayRef.current;
    const maxStart = view ? Math.max(0, view.length - poolSizeRef.current) : 0;
    pendingIndexRef.current = Math.min(rawStart, maxStart);
    dirtyRef.current = true;
  }, [viewArrayRef]);
  
  // ─── Expose imperative refresh via forwarded ref ─────────────────────────────
  
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Expose _rpaRefresh on the DOM node (accessed via forwarded ref)
    el._rpaRefresh = () => {
      renderViewport(pendingIndexRef.current);
    };
    // Also assign the forwarded ref to this element
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [renderViewport, ref]);
  
  // ─── Mount / cleanup ────────────────────────────────────────────────────────
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
  
    buildPool();
    renderViewport(0);
  
    container.addEventListener('scroll', onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(rafLoop);
  
    // Resize observer — rebuilds pool if viewport height changes
    const ro = new ResizeObserver(() => {
      buildPool();
      renderViewport(startIndexRef.current);
    });
    ro.observe(container);
  
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [buildPool, renderViewport, onScroll, rafLoop]);

  // ── Click delegation on pool layer ──────────────────────────────────────
  // Event is delegated to the pool layer, not individual row nodes.
  // We read data-row-id from the closest .grid-row ancestor — this is the
  // stable internal_uid, NOT the pool position, so recycled nodes never
  // report the wrong data row.
  useEffect(() => {
    const layer = poolLayerRef.current;
    if (!layer || !onRowClick) return;

    function handlePoolClick(e) {
      // Gate: only open inspector when stream is paused
      if (!isPausedRef.current) return;
      const rowEl = e.target.closest('.grid-row');
      if (!rowEl) return;
      const rowId = rowEl.dataset.rowId;
      if (rowId) onRowClick(rowId);
    }

    layer.style.pointerEvents = 'auto'; // enable clicks on pool layer
    layer.addEventListener('click', handlePoolClick);
    return () => {
      layer.removeEventListener('click', handlePoolClick);
      // Reset pointer-events on cleanup so it doesn't linger
      if (layer) layer.style.pointerEvents = '';
    };
  }, [onRowClick]); // onRowClick is stable (useCallback in App)
  
  // ─── Spacer height update (totalRows prop change) ───────────────────────────
  
  useEffect(() => {
    if (spacerRef.current) {
      spacerRef.current.style.height = `${totalRows * ROW_HEIGHT}px`;
    }
    // Also re-render viewport since view array may have grown
    renderViewport(startIndexRef.current);
  }, [totalRows, renderViewport]);
  
  // ─── Render ─────────────────────────────────────────────────────────────────
  
  return (
    <div className={`grid-panel${isPaused ? ' is-paused' : ''}`}>
      {/* Sticky column headers */}
      <div className="grid-header" role="row">
        {COLUMNS.map(col => (
          <SortableHeader
            key={col.key}
            field={col.key}
            label={col.label}
            className={col.cls}
            sortKeys={sortKeys}
            onSort={onSort}
          />
        ))}
      </div>

      {/* Scrollable viewport */}
      <div
        ref={containerRef}
        className="grid-scroll-container"
        role="grid"
        aria-label="RPA projects grid"
        aria-rowcount={totalRows}
      >
        {/* Tall spacer defines total scrollable height */}
        <div ref={spacerRef} className="grid-spacer" aria-hidden="true" />

        {/* Absolutely-positioned row pool layer */}
        <div ref={poolLayerRef} className="grid-row-pool" aria-hidden="true" />
      </div>
    </div>
  );
}));

export default VirtualizedGrid;
