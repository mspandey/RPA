import { useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { getStore } from '../state/rpaStore.js';

export default function AnalyticsDashboard({ onClose }) {
  const statusCanvas = useRef(null);
  const industryCanvas = useRef(null);
  const roiCanvas = useRef(null);
  const chartRefs = useRef({});

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const store = getStore();
    
    // ─── Data Aggregation ──────────────────────────────────────────────────────
    const statusCounts = { Active: 0, Paused: 0, Completed: 0 };
    const industryStats = {};
    const roiBuckets = { '<0%': 0, '0-50%': 0, '50-100%': 0, '100-200%': 0, '>200%': 0 };

    store.forEach(row => {
      // 1. Status Distribution
      const status = row.project_status || 'Unknown';
      if (statusCounts[status] !== undefined) statusCounts[status]++;
      else statusCounts[status] = 1;

      // 2. Industry Budgets vs Savings
      const ind = row.industry || 'Unknown';
      if (!industryStats[ind]) industryStats[ind] = { budget: 0, savings: 0 };
      industryStats[ind].budget += Number(row.budget_usd) || 0;
      industryStats[ind].savings += Number(row.annual_savings_usd) || 0;

      // 3. ROI Distribution
      const roi = Number(row.roi_percent);
      if (isFinite(roi)) {
        if (roi < 0) roiBuckets['<0%']++;
        else if (roi <= 50) roiBuckets['0-50%']++;
        else if (roi <= 100) roiBuckets['50-100%']++;
        else if (roi <= 200) roiBuckets['100-200%']++;
        else roiBuckets['>200%']++;
      }
    });

    // ─── Chart.js Theming ──────────────────────────────────────────────────────
    const fontTheme = {
      family: 'var(--font-mono, monospace)',
      size: 10,
      color: '#A0B0B9'
    };

    const darkOptions = {
      responsive: true,
      maintainAspectRatio: false,
      color: '#A0B0B9',
      plugins: {
        legend: { labels: { color: '#A0B0B9', font: fontTheme } },
        tooltip: {
          titleFont: fontTheme,
          bodyFont: fontTheme,
          backgroundColor: 'rgba(25, 36, 40, 0.9)',
          borderColor: '#3A4A52',
          borderWidth: 1
        }
      },
      scales: {
        x: { 
          grid: { color: '#2A363B' }, 
          ticks: { color: '#A0B0B9', font: fontTheme } 
        },
        y: { 
          grid: { color: '#2A363B' }, 
          ticks: { color: '#A0B0B9', font: fontTheme } 
        }
      }
    };

    // ─── Initialization ────────────────────────────────────────────────────────
    
    // Status Chart
    if (statusCanvas.current) {
      chartRefs.current.status = new Chart(statusCanvas.current, {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#00E5FF', '#FFB000', '#A0B0B9', '#FF4081'],
            borderColor: '#0C1418',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          color: '#A0B0B9',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#A0B0B9', font: fontTheme, padding: 20 } }
          },
          cutout: '60%'
        }
      });
    }

    // Industry Chart
    if (industryCanvas.current) {
      const labels = Object.keys(industryStats);
      chartRefs.current.industry = new Chart(industryCanvas.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Budget (USD)',
              data: labels.map(l => industryStats[l].budget),
              backgroundColor: '#3A4A52',
            },
            {
              label: 'Savings (USD)',
              data: labels.map(l => industryStats[l].savings),
              backgroundColor: '#FFB000',
            }
          ]
        },
        options: darkOptions
      });
    }

    // ROI Chart
    if (roiCanvas.current) {
      chartRefs.current.roi = new Chart(roiCanvas.current, {
        type: 'bar',
        data: {
          labels: Object.keys(roiBuckets),
          datasets: [{
            label: 'Project Count',
            data: Object.values(roiBuckets),
            backgroundColor: '#00E5FF',
          }]
        },
        options: darkOptions
      });
    }

    // ─── Cleanup ───────────────────────────────────────────────────────────────
    // STRICT MEMORY LEAK PREVENTION: chart.destroy() is non-negotiable.
    return () => {
      if (chartRefs.current.status) {
        chartRefs.current.status.destroy();
        chartRefs.current.status = null;
      }
      if (chartRefs.current.industry) {
        chartRefs.current.industry.destroy();
        chartRefs.current.industry = null;
      }
      if (chartRefs.current.roi) {
        chartRefs.current.roi.destroy();
        chartRefs.current.roi = null;
      }
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="insp-backdrop" 
        aria-hidden="true" 
        onClick={onClose} 
        style={{ 
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999998 
        }} 
      />
      
      {/* Centered Modal */}
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-label="Analytics Dashboard"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
          backgroundColor: '#0a1410',
          border: '1px solid var(--border-bright)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 100px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999999,
          fontFamily: 'var(--font-mono, monospace)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-bright)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface, #0a1114)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--accent, #ffb000)', fontWeight: 'bold' }}>ANALYTICS // OVERVIEW</span>
            <span style={{ color: 'var(--text-muted, #526c7a)', fontSize: '11px' }}>STREAM PAUSED</span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #526c7a)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'inherit',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = '#fff'}
          onMouseOut={(e) => e.target.style.color = 'var(--text-muted, #526c7a)'}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Chart Grid */}
        <div style={{
          flex: 1,
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gridTemplateRows: '1fr 1fr',
          gap: '24px',
          overflowY: 'auto'
        }}>
          {/* Status Distribution */}
          <div style={{ 
            backgroundColor: 'var(--bg-surface, #0a1114)', 
            border: '1px solid var(--border, #1a2b35)', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '4px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-primary, #ffc43d)', letterSpacing: '0.05em' }}>
              STATUS // DISTRIBUTION
            </h3>
            <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
              <canvas ref={statusCanvas} />
            </div>
          </div>

          {/* ROI Distribution */}
          <div style={{ 
            backgroundColor: 'var(--bg-surface, #0a1114)', 
            border: '1px solid var(--border, #1a2b35)', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '4px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-primary, #ffc43d)', letterSpacing: '0.05em' }}>
              ROI // PCT BUCKETS
            </h3>
            <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
              <canvas ref={roiCanvas} />
            </div>
          </div>

          {/* Industry Budget vs Savings (spanning full width at bottom) */}
          <div style={{ 
            gridColumn: '1 / -1',
            backgroundColor: 'var(--bg-surface, #0a1114)', 
            border: '1px solid var(--border, #1a2b35)', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '4px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-primary, #ffc43d)', letterSpacing: '0.05em' }}>
              INDUSTRY // BUDGET VS SAVINGS (USD)
            </h3>
            <div style={{ flex: 1, position: 'relative', minHeight: '250px' }}>
              <canvas ref={industryCanvas} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
