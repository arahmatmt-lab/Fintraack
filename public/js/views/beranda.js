/**
 * FINTRACK — Beranda / Dashboard (Bagian 5.1 Dokumen Rancangan)
 * Menampilkan total saldo dompet, ringkasan pemasukan/pengeluaran/selisih bersih,
 * grafik tren & kategori (Chart.js), transaksi terbaru, serta ringkasan target tabungan & hutang/piutang.
 */

import { db } from '../db.js';
import { renderCategoryDoughnut, renderTrendChart } from '../charts.js';
import { esc, formatCompactRp, formatRp, icon, monthNameID, toISODate } from '../utils.js';
import { openTransactionModal, renderTransactionRow } from './transaksi.js';

let periodMode = 'month'; // 'week' | 'month' | 'year'

function filterByPeriod(txs, mode) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const ymPrefix = `${y}-${m}`;

  if (mode === 'year') {
    return txs.filter((t) => (t.transaction_date || '').startsWith(String(y)));
  }
  if (mode === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    const startISO = toISODate(start);
    const endISO = toISODate(now);
    return txs.filter((t) => t.transaction_date >= startISO && t.transaction_date <= endISO);
  }
  return txs.filter((t) => (t.transaction_date || '').startsWith(ymPrefix));
}

function buildTrendSeries(allTxs, mode) {
  const now = new Date();
  if (mode === 'week') {
    const labels = [];
    const inc = [];
    const exp = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = toISODate(d);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const dayTx = allTxs.filter((t) => t.transaction_date === iso);
      inc.push(dayTx.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      exp.push(dayTx.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
    return { labels, inc, exp };
  }

  if (mode === 'year') {
    const y = now.getFullYear();
    const labels = [];
    const inc = [];
    const exp = [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${y}-${String(m).padStart(2, '0')}`;
      labels.push(monthNameID(m).slice(0, 3));
      const mTx = allTxs.filter((t) => (t.transaction_date || '').startsWith(prefix));
      inc.push(mTx.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      exp.push(mTx.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
    return { labels, inc, exp };
  }

  // Default 'month': 4 bulan terakhir agar tren terlihat kaya
  const labels = [];
  const inc = [];
  const exp = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    labels.push(monthNameID(d.getMonth() + 1).slice(0, 3));
    const mTx = allTxs.filter((t) => (t.transaction_date || '').startsWith(prefix));
    inc.push(mTx.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
    exp.push(mTx.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
  }
  return { labels, inc, exp };
}

export function renderBeranda(container, ctx) {
  const user = db.getCurrentUser();
  const wallets = db.getWallets(false);
  const allTxs = db.getTransactions();
  const catsMap = db.getCategoryMap();
  const walletsMap = new Map(db.getWallets(true).map((w) => [w.wallet_id, w]));

  const totalBalance = wallets.reduce((acc, w) => acc + Number(w.current_balance || 0), 0);
  const periodTxs = filterByPeriod(allTxs, periodMode);
  const totalIncome = periodTxs.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const totalExpense = periodTxs.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0);
  const netFlow = totalIncome - totalExpense;

  // Kategori pengeluaran periode ini
  const catTotals = new Map();
  for (const t of periodTxs) {
    if (t.transaction_type !== 'expense') continue;
    catTotals.set(t.category_id, (catTotals.get(t.category_id) || 0) + Number(t.amount));
  }
  const catBreakdown = Array.from(catTotals.entries())
    .map(([cid, amt]) => ({
      name: catsMap.get(cid)?.category_name || 'Lainnya',
      color: catsMap.get(cid)?.color || '#142B4A',
      amount: amt
    }))
    .sort((a, b) => b.amount - a.amount);

  const budgets = db.getBudgets(new Date().getMonth() + 1, new Date().getFullYear());
  const overallBudget = budgets.find((b) => b.category_id === 'ALL');
  const currentMonthPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthExpense = allTxs
    .filter((t) => t.transaction_type === 'expense' && (t.transaction_date || '').startsWith(currentMonthPrefix))
    .reduce((a, t) => a + Number(t.amount), 0);

  const goals = db.getSavingsGoals();
  const debts = db.getDebts().filter((d) => d.status === 'active');
  const totalPayable = debts.filter((d) => d.debt_type === 'payable').reduce((a, d) => a + Number(d.remaining_amount), 0);
  const totalReceivable = debts.filter((d) => d.debt_type === 'receivable').reduce((a, d) => a + Number(d.remaining_amount), 0);

  const periodLabel = periodMode === 'week' ? '7 Hari Terakhir' : periodMode === 'year' ? 'Tahun Ini' : 'Bulan Ini';

  container.innerHTML = `
    <!-- Hero Total Saldo (Navy Neumorphism) -->
    <section class="neu-hero-card">
      <div class="hero-top-row">
        <div>
          <div class="hero-label">Halo, ${esc(user?.name?.split(' ')[0] || 'Pengguna')} • Total Saldo</div>
          <div class="hero-balance tabular">${formatRp(totalBalance)}</div>
        </div>
        <span class="hero-badge-glass">${wallets.length} Dompet</span>
      </div>

      <div class="hero-stats-grid">
        <div class="hero-stat-pill">
          <div class="stat-title">Pemasukan</div>
          <div class="stat-val tabular text-emerald-bright">${formatCompactRp(totalIncome)}</div>
        </div>
        <div class="hero-stat-pill">
          <div class="stat-title">Pengeluaran</div>
          <div class="stat-val tabular" style="color:#F8FAFC;">${formatCompactRp(totalExpense)}</div>
        </div>
        <div class="hero-stat-pill">
          <div class="stat-title">Selisih Bersih</div>
          <div class="stat-val tabular" style="color:${netFlow >= 0 ? '#34D399' : '#FCA5A5'};">${netFlow >= 0 ? '+' : ''}${formatCompactRp(netFlow)}</div>
        </div>
      </div>
    </section>

    <!-- Selector Periode -->
    <div class="neu-segmented">
      <button type="button" class="neu-seg-btn ${periodMode === 'week' ? 'active' : ''}" data-period="week">Minggu Ini</button>
      <button type="button" class="neu-seg-btn ${periodMode === 'month' ? 'active' : ''}" data-period="month">Bulan Ini</button>
      <button type="button" class="neu-seg-btn ${periodMode === 'year' ? 'active' : ''}" data-period="year">Tahun Ini</button>
    </div>

    <!-- Aksi Cepat (Glassmorphism Buttons) -->
    <div class="quick-actions-grid">
      <button type="button" class="quick-action-btn" id="qa-add">
        <span class="quick-action-icon bg-grad-blue">${icon('plus')}</span>
        <span>Catat</span>
      </button>
      <button type="button" class="quick-action-btn" id="qa-scan">
        <span class="quick-action-icon bg-grad-emerald">${icon('scan')}</span>
        <span>Scan Struk</span>
      </button>
      <button type="button" class="quick-action-btn" id="qa-report">
        <span class="quick-action-icon bg-grad-blue">${icon('chart')}</span>
        <span>Laporan</span>
      </button>
    </div>

    <!-- Daftar Dompet -->
    <section>
      <div class="section-head">
        <h2 class="section-title">Dompet Saya</h2>
        <button type="button" class="glass-pill" id="btn-go-wallets">Kelola</button>
      </div>
      <div class="h-scroll">
        ${wallets.map((w) => `
          <div class="wallet-chip-card" data-open-wallets="1">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <span class="wallet-dot" style="background:${esc(w.color || '#142B4A')};"></span>
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--slate-soft);">${esc(w.wallet_type)}</span>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(w.wallet_name)}</div>
              <div class="tabular" style="font-size:14px;font-weight:800;color:var(--slate);margin-top:2px;">${formatRp(w.current_balance)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- Grafik Tren Pemasukan & Pengeluaran -->
    <section class="neu-card">
      <div class="section-head">
        <div>
          <h2 class="section-title">Grafik Tren Keuangan</h2>
          <p class="section-subtitle">Pemasukan vs Pengeluaran (${esc(periodLabel)})</p>
        </div>
        <span class="badge badge-emerald">Chart.js</span>
      </div>
      <div class="chart-wrap">
        <canvas id="home-trend-chart"></canvas>
      </div>
    </section>

    <!-- Grafik Pengeluaran per Kategori -->
    <section class="neu-card">
      <div class="section-head">
        <div>
          <h2 class="section-title">Pengeluaran per Kategori</h2>
          <p class="section-subtitle">${esc(periodLabel)} • Total ${formatRp(totalExpense)}</p>
        </div>
      </div>
      ${catBreakdown.length > 0 ? `
        <div class="chart-wrap-sm">
          <canvas id="home-cat-chart"></canvas>
        </div>
      ` : `<div class="empty-state">Belum ada pengeluaran pada periode ini.</div>`}
    </section>

    <!-- Ringkasan Anggaran, Target & Hutang -->
    <section class="neu-card">
      <div class="section-head">
        <h2 class="section-title">Ringkasan Anggaran, Target & Hutang</h2>
      </div>

      ${overallBudget ? (() => {
        const pct = Math.min(100, Math.round((monthExpense / Number(overallBudget.limit_amount)) * 100));
        const barCls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';
        return `
          <div class="neu-inset-box" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px;">
              <span class="text-navy">Anggaran Bulanan (${pct}%)</span>
              <span class="tabular">${formatCompactRp(monthExpense)} / ${formatCompactRp(overallBudget.limit_amount)}</span>
            </div>
            <div class="neu-progress-track">
              <div class="neu-progress-fill ${barCls}" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })() : ''}

      <div class="form-row">
        <div class="neu-card-sm" id="card-sum-goals" style="cursor:pointer;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--emerald-dark);">
            ${icon('target')} Target Tabungan
          </div>
          <div class="tabular" style="font-size:13.5px;font-weight:800;color:var(--navy);margin-top:6px;">
            ${goals.length} Target Aktif
          </div>
          <div style="font-size:11px;color:var(--slate-soft);margin-top:2px;">
            Terkumpul ${formatCompactRp(goals.reduce((a, g) => a + Number(g.current_amount || 0), 0))}
          </div>
        </div>

        <div class="neu-card-sm" id="card-sum-debts" style="cursor:pointer;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--blue);">
            ${icon('debt')} Hutang & Piutang
          </div>
          <div class="tabular" style="font-size:12px;font-weight:800;color:var(--navy);margin-top:6px;">
            Hutang: ${formatCompactRp(totalPayable)}
          </div>
          <div class="tabular" style="font-size:11px;font-weight:700;color:var(--emerald-dark);margin-top:2px;">
            Piutang: ${formatCompactRp(totalReceivable)}
          </div>
        </div>
      </div>
    </section>

    <!-- Transaksi Terbaru -->
    <section>
      <div class="section-head">
        <h2 class="section-title">Transaksi Terbaru</h2>
        <button type="button" class="glass-pill" id="btn-all-tx">Lihat Semua</button>
      </div>
      <div class="tx-list">
        ${allTxs.slice(0, 5).map((tx) => renderTransactionRow(tx, catsMap, walletsMap)).join('') || '<div class="neu-card empty-state">Belum ada transaksi.</div>'}
      </div>
    </section>
  `;

  // Render Chart.js
  const trendData = buildTrendSeries(allTxs, periodMode);
  renderTrendChart(
    container.querySelector('#home-trend-chart'),
    trendData.labels,
    trendData.inc,
    trendData.exp,
    periodMode === 'year' ? 'bar' : 'line'
  );

  if (catBreakdown.length > 0) {
    renderCategoryDoughnut(
      container.querySelector('#home-cat-chart'),
      catBreakdown.slice(0, 6).map((c) => c.name),
      catBreakdown.slice(0, 6).map((c) => c.amount),
      catBreakdown.slice(0, 6).map((c) => c.color)
    );
  }

  // Event bindings
  container.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      periodMode = btn.getAttribute('data-period');
      renderBeranda(container, ctx);
    });
  });

  container.querySelector('#qa-add')?.addEventListener('click', () => {
    openTransactionModal({ defaultType: 'expense', onSaved: () => ctx.refresh() });
  });
  container.querySelector('#qa-scan')?.addEventListener('click', () => ctx.openScanner());
  container.querySelector('#qa-report')?.addEventListener('click', () => ctx.openSubpage('laporan'));

  container.querySelector('#btn-go-wallets')?.addEventListener('click', () => ctx.openSubpage('dompet'));
  container.querySelectorAll('[data-open-wallets]').forEach((el) => {
    el.addEventListener('click', () => ctx.openSubpage('dompet'));
  });
  container.querySelector('#card-sum-goals')?.addEventListener('click', () => ctx.openSubpage('target'));
  container.querySelector('#card-sum-debts')?.addEventListener('click', () => ctx.openSubpage('hutang'));
  container.querySelector('#btn-all-tx')?.addEventListener('click', () => ctx.navigate('transaksi'));

  container.querySelectorAll('[data-tx-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-tx-id');
      const found = allTxs.find((t) => t.transaction_id === id);
      if (found) openTransactionModal({ existingTx: found, onSaved: () => ctx.refresh() });
    });
  });
}
