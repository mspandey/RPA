/**
 * DeptChart.jsx — Department analytics bar chart, hand-drawn on Canvas
 *
 * No charting library used. Plain Canvas 2D API.
 * Updates via imperative canvas draw on prop change — not via React renders.
 * Shows top 10 departments by total annual_savings_usd from the current view.
 */

import { useRef, useEffect, memo } from 'react';

const DeptChart = memo(function DeptChart({ viewArrayRef, triggerCount }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const view = viewArrayRef.current || [];
    if (view.length === 0) return;

    // Aggregate savings by department
    const deptMap = new Map();
    for (let i = 0; i < view.length; i++) {
      const row = view[i];
      const dept = row.department || '(Unknown)';
      const savings = Number(row.annual_savings_usd) || 0;
      deptMap.set(dept, (deptMap.get(dept) || 0) + savings);
    }

    // Top 10 by savings
    const entries = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (entries.length === 0) return;

    const maxVal = entries[0][1];
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;
    const width  = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width  = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a1114';
    ctx.fillRect(0, 0, width, height);

    const PADDING_L = 8;
    const PADDING_R = 8;
    const PADDING_T = 6;
    const LABEL_H   = 24;
    const barH      = (height - PADDING_T - LABEL_H) / entries.length;
    const BAR_GAP   = 3;
    const actualBarH = barH - BAR_GAP;
    const maxBarW   = width - PADDING_L - PADDING_R - 90; // leave room for label

    ctx.font = `500 10px 'JetBrains Mono', 'Fira Code', monospace`;

    entries.forEach(([dept, value], i) => {
      const y    = PADDING_T + i * barH;
      const pct  = value / maxVal;
      const bW   = pct * maxBarW;

      if (bW > 0) {
        // Bar - radar style gradient (dark transparent to semi-opaque amber)
        const gradient = ctx.createLinearGradient(PADDING_L, 0, PADDING_L + bW, 0);
        gradient.addColorStop(0, 'rgba(255, 176, 0, 0.03)');
        gradient.addColorStop(1, 'rgba(255, 176, 0, 0.50)');
        ctx.fillStyle = gradient;
        ctx.fillRect(PADDING_L, y + 2, bW, actualBarH - 4);

        // Leading edge (sensor peak) with shadow glow
        ctx.shadowColor = '#ffb000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffb000';
        ctx.fillRect(PADDING_L + bW - 2, y + 2, 2, actualBarH - 4);
        ctx.shadowBlur = 0; // reset
      }

      // Department label
      ctx.shadowColor = 'rgba(255, 176, 0, 0.4)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffc43d';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        dept.length > 14 ? dept.slice(0, 13) + '…' : dept,
        PADDING_L + maxBarW + 4,
        y + actualBarH / 2 + 1
      );
      ctx.shadowBlur = 0;
    });

    // X axis label
    ctx.fillStyle = '#526c7a';
    ctx.font = "9px 'JetBrains Mono', 'Fira Code', monospace";
    ctx.textBaseline = 'bottom';
    ctx.fillText('SAVINGS // USD (ANNUAL)', PADDING_L, height - 2);

  }, [viewArrayRef, triggerCount]);

  return (
    <div className="chart-panel">
      <div className="chart-panel-header">DEPT // SAVINGS</div>
      <div className="chart-canvas-wrap">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
});

export default DeptChart;
