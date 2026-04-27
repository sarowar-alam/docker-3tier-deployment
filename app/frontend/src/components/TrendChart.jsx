import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { IconAlertCircle, IconTrendingUp } from './Icons';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Design tokens kept in sync with index.css CSS variables (dark theme)
const CHART_STYLE = {
  line:          '#6366f1',
  point:         '#818cf8',
  grid:          'rgba(255, 255, 255, 0.04)',
  ticks:         '#64748b',
  tooltipBg:     '#0e0e1a',
  tooltipBorder: 'rgba(99, 102, 241, 0.3)',
  font:          "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

function buildGradient(ctx, chartArea) {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0,    'rgba(99, 102, 241, 0.0)');
  gradient.addColorStop(0.45, 'rgba(99, 102, 241, 0.07)');
  gradient.addColorStop(1,    'rgba(99, 102, 241, 0.20)');
  return gradient;
}

// Draws healthy-range zone and BMI threshold lines before the dataset renders
const bmiReferenceBandsPlugin = {
  id: 'bmiReferenceBands',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.y) return;
    const { left, right } = chartArea;
    const yScale = scales.y;
    const yMin = yScale.min;
    const yMax = yScale.max;

    ctx.save();

    // Healthy zone fill (18.5 – 25.0)
    const zoneTop = Math.min(yMax, 25);
    const zoneBot = Math.max(yMin, 18.5);
    if (zoneTop > zoneBot) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
      ctx.fillRect(
        left,
        yScale.getPixelForValue(zoneTop),
        right - left,
        yScale.getPixelForValue(zoneBot) - yScale.getPixelForValue(zoneTop)
      );
    }

    // Reference threshold lines
    const thresholds = [
      { value: 18.5, color: 'rgba(96, 165, 250, 0.55)',  label: '18.5' },
      { value: 25,   color: 'rgba(245, 158, 11, 0.55)',  label: '25' },
      { value: 30,   color: 'rgba(239, 68, 68, 0.55)',   label: '30' },
    ];

    thresholds.forEach(({ value, color, label }) => {
      if (value < yMin || value > yMax) return;
      const y = yScale.getPixelForValue(value);

      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = `600 10px ${CHART_STYLE.font}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, right - 6, y - 3);
    });

    ctx.restore();
  },
};

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 700, easing: 'easeInOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    title:  { display: false },
    tooltip: {
      backgroundColor:  CHART_STYLE.tooltipBg,
      borderColor:      CHART_STYLE.tooltipBorder,
      borderWidth:      1,
      titleColor:       '#94a3b8',
      bodyColor:        '#f1f5f9',
      padding:          { x: 16, y: 12 },
      cornerRadius:     10,
      caretSize:        5,
      caretPadding:     8,
      displayColors:    false,
      titleFont:        { family: CHART_STYLE.font, size: 11, weight: '500' },
      bodyFont:         { family: CHART_STYLE.font, size: 14, weight: '700' },
      callbacks: {
        title: (items) => items[0].label,
        label: (item)  => `BMI  ${item.formattedValue}`,
      },
    },
  },
  scales: {
    x: {
      grid:   { color: CHART_STYLE.grid, drawBorder: false },
      border: { display: false },
      ticks: {
        color:         CHART_STYLE.ticks,
        font:          { family: CHART_STYLE.font, size: 11 },
        maxRotation:   0,
        maxTicksLimit: 8,
      },
    },
    y: {
      grid:   { color: CHART_STYLE.grid, drawBorder: false },
      border: { display: false },
      // Always include all three BMI thresholds (18.5 / 25 / 30) in the visible range
      suggestedMin: 14,
      suggestedMax: 36,
      ticks: {
        color: CHART_STYLE.ticks,
        font:  { family: CHART_STYLE.font, size: 11 },
        callback: (val) => val.toFixed(1),
      },
    },
  },
};

export default function TrendChart() {
  const [trendRows, setTrendRows] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    api.get('/measurements/trends')
      .then((res) => {
        const rows = res.data.rows;
        if (rows && rows.length > 0) setTrendRows(rows);
      })
      .catch(() => setError('Unable to load trend data. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="chart-loading" aria-busy="true" aria-label="Loading trend chart">
        <div className="chart-skeleton">
          <div className="shimmer-overlay" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        <IconAlertCircle />
        <span>{error}</span>
      </div>
    );
  }

  if (!trendRows) {
    return (
      <div className="empty-state empty-state--chart">
        <div className="empty-icon">
          <IconTrendingUp size={24} />
        </div>
        <p className="empty-title">Not enough data yet</p>
        <p className="empty-sub">
          Log measurements on at least two separate days to build your BMI trend line.
        </p>
      </div>
    );
  }

  const labels = trendRows.map((row) =>
    new Date(row.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const values = trendRows.map((row) => parseFloat(parseFloat(row.avg_bmi).toFixed(1)));

  const data = {
    labels,
    datasets: [
      {
        label:              'Avg BMI',
        data:               values,
        borderColor:        CHART_STYLE.line,
        borderWidth:        2.5,
        pointBackgroundColor:      CHART_STYLE.point,
        pointBorderColor:          'transparent',
        pointRadius:               3.5,
        pointHoverRadius:          7,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor:     CHART_STYLE.line,
        pointHoverBorderWidth:     2,
        tension: 0.4,
        fill:    true,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'transparent';
          return buildGradient(canvasCtx, chartArea);
        },
      },
    ],
  };

  return <Line ref={chartRef} data={data} options={CHART_OPTIONS} plugins={[bmiReferenceBandsPlugin]} />;
}