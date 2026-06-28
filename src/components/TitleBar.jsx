import { memo } from 'react';

const TitleBar = memo(function TitleBar({ isPaused }) {
  return (
    <div className="title-bar" role="banner">
      <div className="title-bar-brand">
        <h1 className="title-bar-name mono">RPA</h1>
        <span className="title-bar-tagline">LIVE TELEMETRY // 50,000+ RPA PROJECTS // REAL-TIME FLEET STATUS</span>
      </div>
      
      {/* Live-pulse indicator */}
      <div
        className="kpi-card kpi-pulse-card title-pulse"
        aria-hidden="true"
        title={isPaused ? 'Stream paused' : 'Stream live'}
      >
        <div className="kpi-pulse-wrap">
          <div className={`live-pulse${isPaused ? ' paused' : ''}`} />
          <span className="kpi-pulse-label">{isPaused ? 'PAUSED' : 'LIVE'}</span>
        </div>
      </div>
    </div>
  );
});

export default TitleBar;
