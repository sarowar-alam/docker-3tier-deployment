import React from 'react';
import { IconHeartPulse } from './Icons';

export default function Navbar({ lastMeasurement, totalRecords = 0 }) {
  const lastLogText = lastMeasurement
    ? new Date(lastMeasurement.measurement_date || lastMeasurement.created_at)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <header className="navbar">
      <nav className="navbar-inner" aria-label="VitalTrack navigation">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <IconHeartPulse size={18} />
          </div>
          <span className="navbar-product-name">VitalTrack</span>
          <span className="navbar-version-badge">Beta</span>
        </div>

        <div className="navbar-meta">
          <span className="navbar-last-log">
            {lastLogText
              ? <>Last log <strong>{lastLogText}</strong></>
              : <span className="navbar-no-log">No logs yet</span>
            }
          </span>
          <div className="navbar-status-pill" role="status" aria-label="Health tracking is active">
            <span className="status-indicator" />
            <span>Active</span>
          </div>
        </div>
      </nav>
    </header>
  );
}
