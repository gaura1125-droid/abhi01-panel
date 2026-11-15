import React from 'react';

function StatusIndicators() {
  return (
    <div className="status-indicators" role="status" aria-live="polite">
      <div className="status-item">
        <span className="status-dot" aria-hidden="true"></span>
        <span className="status-label">Core Online</span>
      </div>
      <div className="status-item">
        <span className="status-dot cyan" aria-hidden="true"></span>
        <span className="status-label">Grid Active</span>
      </div>
      <div className="status-item">
        <span className="status-dot purple" aria-hidden="true"></span>
        <span className="status-label">Shield Armed</span>
      </div>
    </div>
  );
}

export default StatusIndicators;