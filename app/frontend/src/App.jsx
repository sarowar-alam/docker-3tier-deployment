import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import MeasurementForm from './components/MeasurementForm';
import TrendChart from './components/TrendChart';
import { IconActivity, IconFlame, IconZap, IconBarChart, IconCalendar, IconAlertCircle } from './components/Icons';
import api from './api';

// Maps backend bmi_category string to a CSS modifier class
const bmiCategoryClass = (category) => {
  const map = {
    Underweight: 'bmi--underweight',
    Normal:      'bmi--normal',
    Overweight:  'bmi--overweight',
    Obese:       'bmi--obese',
  };
  return map[category] ?? '';
};

// ─── Sub-components ────────────────────────────────────────

function KpiCard({ label, sublabel, value, unit, icon, variant, delta }) {
  const deltaStr = delta !== null && delta !== undefined
    ? `${delta >= 0 ? '+' : ''}${delta}`
    : null;
  return (
    <div className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-icon-wrap">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value-row">
          <span className="kpi-value">{value ?? '—'}</span>
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        <span className="kpi-label">{label}</span>
        {sublabel && <span className="kpi-sublabel">{sublabel}</span>}
        {deltaStr && (
          <div className="kpi-delta">
            {deltaStr}{unit ? ` ${unit}` : ''}
            <span className="kpi-delta-label"> vs prev</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="kpi-card kpi-skeleton">
      <div className="skeleton-box skeleton-icon" />
      <div className="kpi-body">
        <div className="skeleton-box skeleton-value" />
        <div className="skeleton-box skeleton-label" />
      </div>
    </div>
  );
}

// Mini BMI range bar: scale from 14 to 40, marker positioned by CSS left %
function BmiRangeBar({ bmi }) {
  const pct = Math.min(100, Math.max(0, ((bmi - 14) / 26) * 100)).toFixed(1);
  return (
    <div className="bmi-range-bar" aria-hidden="true">
      <div className="bmi-range-segments">
        <div className="bmi-seg bmi-seg--under" />
        <div className="bmi-seg bmi-seg--normal" />
        <div className="bmi-seg bmi-seg--over" />
        <div className="bmi-seg bmi-seg--obese" />
      </div>
      <div className="bmi-range-marker" style={{ left: `${pct}%` }} />
    </div>
  );
}

function HistoryItem({ row, index }) {
  const date = new Date(row.measurement_date || row.created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <li className="history-item" style={{ '--stagger': index }}>
      <div className="history-date">
        <IconCalendar />
        <span>{formattedDate}</span>
      </div>
      <div className="history-metrics">
        <div className={`history-bmi-badge ${bmiCategoryClass(row.bmi_category)}`}>
          <span className="badge-bmi-value">{row.bmi}</span>
          <span className="badge-bmi-label">{row.bmi_category}</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{row.bmr}</span>
          <span className="history-stat-label">BMR</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{row.daily_calories}</span>
          <span className="history-stat-label">kcal/day</span>
        </div>
      </div>
    </li>
  );
}

// ─── Main App ──────────────────────────────────────────────

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/measurements');
      setRows(res.data.rows);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load measurements. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latest       = rows[0] ?? null;
  const prevRow      = rows[1] ?? null;
  const totalRecords = rows.length;

  // Deltas: change vs previous measurement (null when only one record exists)
  const bmiDelta = latest && prevRow ? +(latest.bmi - prevRow.bmi).toFixed(1) : null;
  const bmrDelta = latest && prevRow ? Math.round(latest.bmr - prevRow.bmr) : null;
  const calDelta = latest && prevRow ? Math.round(latest.daily_calories - prevRow.daily_calories) : null;

  // Count distinct days logged in the current calendar month
  const activeDaysThisMonth = (() => {
    const now = new Date();
    return new Set(
      rows
        .filter(r => {
          const d = new Date(r.measurement_date || r.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .map(r => (r.measurement_date || r.created_at).slice(0, 10))
    ).size;
  })();

  // Insight-driven hero copy — contextual, not generic greeting
  const heroInsight = (() => {
    if (!latest) return {
      headline: 'Track your health.',
      sub: 'Log your first measurement below. BMI, resting rate, and daily calorie targets will appear here.',
    };
    if (bmiDelta === null) return {
      headline: 'Baseline established.',
      sub: `Starting BMI of ${latest.bmi} — ${latest.bmi_category.toLowerCase()} range. Keep logging to build your trend.`,
    };
    const abs = Math.abs(bmiDelta);
    if (abs < 0.2) return {
      headline: 'Holding steady.',
      sub: `BMI unchanged at ${latest.bmi}. Consistently ${latest.bmi_category.toLowerCase()}. Strong consistency.`,
    };
    if (bmiDelta < 0) return {
      headline: `Down ${abs} — good direction.`,
      sub: `BMI dropped from ${prevRow.bmi} to ${latest.bmi}. Currently ${latest.bmi_category.toLowerCase()} range.`,
    };
    return {
      headline: `Up ${abs} — worth monitoring.`,
      sub: `BMI increased from ${prevRow.bmi} to ${latest.bmi}. Currently ${latest.bmi_category.toLowerCase()} range.`,
    };
  })();

  const historySubtitle = loading
    ? 'Fetching records…'
    : totalRecords > 0
      ? `${Math.min(totalRecords, 10)} of ${totalRecords} · newest first`
      : 'No entries yet';

  return (
    <>
      <Navbar lastMeasurement={latest} totalRecords={totalRecords} />

      <main className="main-layout">

        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="hero" aria-label="Dashboard overview">
          <div className="hero-text">
            <h1 className="hero-headline">{heroInsight.headline}</h1>
            <p className="hero-sub">{heroInsight.sub}</p>
          </div>
          {latest && (
            <div
              className={`hero-bmi-chip ${bmiCategoryClass(latest.bmi_category)}`}
              aria-label={`Current BMI: ${latest.bmi}, ${latest.bmi_category}${bmiDelta !== null ? `, ${bmiDelta >= 0 ? 'up' : 'down'} ${Math.abs(bmiDelta)} from last` : ', baseline'}`}
            >
              <span className="chip-value">{latest.bmi}</span>
              {bmiDelta !== null && (
                <span className={`chip-delta chip-delta--${bmiDelta > 0 ? 'up' : bmiDelta < 0 ? 'down' : 'flat'}`}>
                  {bmiDelta >= 0 ? '+' : ''}{bmiDelta}
                </span>
              )}
              <span className="chip-label">BMI · {latest.bmi_category}</span>
              <BmiRangeBar bmi={latest.bmi} />
            </div>
          )}
        </section>

        {/* ── KPI Cards ────────────────────────────────────── */}
        <section className="kpi-grid" aria-label="Key health metrics">
          {loading ? (
            <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
          ) : (
            <>
              <KpiCard
                variant="accent"
                icon={<IconActivity />}
                label="BMI"
                sublabel={latest?.bmi_category}
                value={latest?.bmi}
                delta={bmiDelta}
              />
              <KpiCard
                variant="success"
                icon={<IconFlame />}
                label="Resting Rate"
                value={latest?.bmr}
                unit="kcal"
                delta={bmrDelta}
              />
              <KpiCard
                variant="warning"
                icon={<IconZap />}
                label="Daily Target"
                value={latest?.daily_calories}
                unit="kcal"
                delta={calDelta}
              />
              <KpiCard
                variant="purple"
                icon={<IconBarChart />}
                label="Days Active"
                sublabel="this month"
                value={activeDaysThisMonth || null}
              />
            </>
          )}
        </section>

        {/* ── Main Content Grid ─────────────────────────────── */}
        <section className="content-grid">

          {/* Form Panel */}
          <div className="glass-card form-panel">
            <div className="panel-header">
              <h2 className="panel-title">Log Measurement</h2>
              <p className="panel-subtitle">Enter your body metrics</p>
            </div>
            <MeasurementForm onSaved={load} lastMeasurement={latest} />
          </div>

          {/* History Panel */}
          <div className="glass-card history-panel">
            <div className="panel-header">
              <h2 className="panel-title">Measurement Log</h2>
              <p className="panel-subtitle">{historySubtitle}</p>
            </div>

            {error && (
              <div className="alert alert--error" role="alert">
                <IconAlertCircle />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="history-skeleton" aria-busy="true" aria-label="Loading history">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="history-item-skeleton">
                    <div className="skeleton-box skeleton-date-line" />
                    <div className="skeleton-box skeleton-data-line" />
                  </div>
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <IconActivity size={24} />
                </div>
                <p className="empty-title">No entries yet</p>
                <p className="empty-sub">
                  Log your first measurement to establish your baseline. Each entry builds your health picture.
                </p>
              </div>
            ) : (
              <ul className="history-list" aria-label="Recent measurements">
                {rows.slice(0, 10).map((row, i) => (
                  <HistoryItem key={row.id} row={row} index={i} />
                ))}
              </ul>
            )}
          </div>

        </section>

        {/* ── Trend Chart ───────────────────────────────────── */}
        <section className="chart-section" aria-label="BMI trend chart">
          <div className="glass-card">
            <div className="panel-header">
              <h2 className="panel-title">30-Day BMI Trend</h2>
              <p className="panel-subtitle">Daily average — rolling 30-day window</p>
            </div>
            <div className="chart-wrap">
              <TrendChart />
            </div>
          </div>
        </section>

      </main>

      <footer className="app-footer">
        <span>VitalTrack</span>
        <span className="footer-sep" aria-hidden="true">·</span>
        <span>Personal Health Dashboard</span>
        <span className="footer-sep" aria-hidden="true">·</span>
        <span>Your data is stored locally</span>
      </footer>
    </>
  );
}