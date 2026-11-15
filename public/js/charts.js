/**
 * FINTRACK — Chart.js Visualization Engine (Bagian 3, 5.1, 5.4, 5.9)
 * Menggunakan palet warna resmi Brandkit:
 * Navy #142B4A | Biru #1D4ED8 | Emerald #10B981 | Putih #F8FAFC | Slate #1E293B
 */

import { formatCompactRp, formatRp } from './utils.js';

const chartRegistry = new WeakMap();

function destroyExisting(canvas) {
  if (!canvas) return;
  const existing = chartRegistry.get(canvas);
  if (existing) {
    existing.destroy();
    chartRegistry.delete(canvas);
  }
}

const BRAND_PALETTE = [
  '#1D4ED8', // Biru
  '#10B981', // Hijau Emerald
  '#142B4A', // Navy
  '#1E293B', // Slate
  '#3B82F6', // Biru Terang
  '#059669', // Emerald Gelap
  '#475569'  // Slate Lembut
];

function getChartThemeColors() {
  const mode = document.documentElement.getAttribute('data-theme') || 'light';
  const css = getComputedStyle(document.documentElement);
  const readVar = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  if (mode === 'night') {
    return {
      legend: readVar('--slate', '#EADCC6'),
      tick: readVar('--slate-muted', '#C6B39A'),
      grid: 'rgba(245, 224, 189, 0.08)',
      doughnutBorder: readVar('--neu-bg', '#16111B'),
      expenseLine: '#F59E0B',
      expenseFillTop: 'rgba(245, 158, 11, 0.28)',
      expenseBar: 'rgba(245, 158, 11, 0.85)',
      pointBorder: '#1D1722',
      tooltipBg: 'rgba(28, 21, 34, 0.94)',
      tooltipText: '#F5EBD6'
    };
  }
  if (mode === 'dark') {
    return {
      legend: readVar('--slate', '#E2E8F0'),
      tick: readVar('--slate-muted', '#94A3B8'),
      grid: 'rgba(148, 163, 184, 0.10)',
      doughnutBorder: readVar('--neu-bg', '#0F172A'),
      expenseLine: '#60A5FA',
      expenseFillTop: 'rgba(96, 165, 250, 0.28)',
      expenseBar: 'rgba(96, 165, 250, 0.86)',
      pointBorder: '#162033',
      tooltipBg: 'rgba(15, 23, 42, 0.94)',
      tooltipText: '#F8FAFC'
    };
  }
  return {
    legend: '#1E293B',
    tick: '#475569',
    grid: 'rgba(20, 43, 74, 0.06)',
    doughnutBorder: '#F8FAFC',
    expenseLine: '#142B4A',
    expenseFillTop: 'rgba(20, 43, 74, 0.28)',
    expenseBar: 'rgba(20, 43, 74, 0.86)',
    pointBorder: '#F8FAFC',
    tooltipBg: 'rgba(20, 43, 74, 0.92)',
    tooltipText: '#F8FAFC'
  };
}

export function renderTrendChart(canvas, labels, incomeData, expenseData, mode = 'line') {
  if (!canvas || typeof window.Chart === 'undefined') return null;
  destroyExisting(canvas);

  const tc = getChartThemeColors();
  const ctx = canvas.getContext('2d');
  const incGrad = ctx.createLinearGradient(0, 0, 0, 200);
  incGrad.addColorStop(0, 'rgba(16, 185, 129, 0.34)');
  incGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

  const expGrad = ctx.createLinearGradient(0, 0, 0, 200);
  expGrad.addColorStop(0, tc.expenseFillTop);
  expGrad.addColorStop(1, 'rgba(20, 43, 74, 0.01)');

  const isBar = mode === 'bar';

  const chart = new window.Chart(ctx, {
    type: isBar ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          borderColor: '#10B981',
          backgroundColor: isBar ? 'rgba(16, 185, 129, 0.85)' : incGrad,
          borderWidth: isBar ? 0 : 2.6,
          borderRadius: isBar ? 8 : 0,
          tension: 0.38,
          fill: !isBar,
          pointRadius: 3.5,
          pointBackgroundColor: '#10B981',
          pointBorderColor: tc.pointBorder,
          pointBorderWidth: 1.5
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: tc.expenseLine,
          backgroundColor: isBar ? tc.expenseBar : expGrad,
          borderWidth: isBar ? 0 : 2.6,
          borderRadius: isBar ? 8 : 0,
          tension: 0.38,
          fill: !isBar,
          pointRadius: 3.5,
          pointBackgroundColor: tc.expenseLine,
          pointBorderColor: tc.pointBorder,
          pointBorderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            color: tc.legend,
            font: { family: 'Plus Jakarta Sans, sans-serif', size: 11, weight: '700' }
          }
        },
        tooltip: {
          backgroundColor: tc.tooltipBg,
          titleColor: tc.tooltipText,
          bodyColor: tc.tooltipText,
          padding: 10,
          cornerRadius: 12,
          callbacks: {
            label: (ctxItem) => `${ctxItem.dataset.label}: ${formatRp(ctxItem.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: tc.tick,
            font: { family: 'Plus Jakarta Sans, sans-serif', size: 10.5, weight: '600' }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: tc.grid },
          ticks: {
            color: tc.tick,
            font: { family: 'Plus Jakarta Sans, sans-serif', size: 10, weight: '600' },
            callback: (val) => formatCompactRp(val)
          }
        }
      }
    }
  });

  chartRegistry.set(canvas, chart);
  return chart;
}

export function renderCategoryDoughnut(canvas, labels, values, customColors = []) {
  if (!canvas || typeof window.Chart === 'undefined') return null;
  destroyExisting(canvas);

  const tc = getChartThemeColors();
  const colors = labels.map((_, idx) => customColors[idx] || BRAND_PALETTE[idx % BRAND_PALETTE.length]);
  const ctx = canvas.getContext('2d');

  const chart = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: tc.doughnutBorder,
          borderWidth: 2.5,
          borderRadius: 6,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 10,
            color: tc.legend,
            font: { family: 'Plus Jakarta Sans, sans-serif', size: 11, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: tc.tooltipBg,
          titleColor: tc.tooltipText,
          bodyColor: tc.tooltipText,
          padding: 10,
          cornerRadius: 12,
          callbacks: {
            label: (ctxItem) => {
              const total = ctxItem.dataset.data.reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((ctxItem.parsed / total) * 100);
              return ` ${ctxItem.label}: ${formatRp(ctxItem.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  chartRegistry.set(canvas, chart);
  return chart;
}

export function renderBudgetComparisonChart(canvas, labels, limitSeries, spentSeries) {
  if (!canvas || typeof window.Chart === 'undefined') return null;
  destroyExisting(canvas);

  const tc = getChartThemeColors();
  const ctx = canvas.getContext('2d');
  const chart = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Batas Anggaran',
          data: limitSeries,
          backgroundColor: 'rgba(29, 78, 216, 0.85)',
          borderRadius: 8
        },
        {
          label: 'Realisasi Belanja',
          data: spentSeries,
          backgroundColor: spentSeries.map((val, i) =>
            val > (limitSeries[i] || 0) ? '#DC2626' : '#10B981'
          ),
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: tc.legend,
            font: { family: 'Plus Jakarta Sans, sans-serif', size: 11, weight: '700' }
          }
        },
        tooltip: {
          backgroundColor: tc.tooltipBg,
          titleColor: tc.tooltipText,
          bodyColor: tc.tooltipText,
          cornerRadius: 12,
          callbacks: {
            label: (ctxItem) => `${ctxItem.dataset.label}: ${formatRp(ctxItem.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tc.tick, font: { size: 11, weight: '700' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: tc.grid },
          ticks: {
            color: tc.tick,
            font: { size: 10, weight: '600' },
            callback: (val) => formatCompactRp(val)
          }
        }
      }
    }
  });

  chartRegistry.set(canvas, chart);
  return chart;
}
