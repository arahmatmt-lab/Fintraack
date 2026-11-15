/**
 * FINTRACK — Anggaran (Bagian 5.4 Dokumen Rancangan)
 * Anggaran bulanan keseluruhan & per kategori, kalkulasi penggunaan otomatis,
 * peringatan ambang 80% & 100%, serta grafik perbandingan antarbulan (Chart.js).
 */

import { db } from '../db.js';
import { renderBudgetComparisonChart } from '../charts.js';
import { esc, formatCompactRp, formatRp, icon, monthNameID, openModal, showToast } from '../utils.js';
import { wireCategorySelectWithAdd } from './categoryPicker.js';

const budgetState = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear()
};

function openBudgetModal(existing = null, onSaved = null) {
  const expenseCats = db.getCategories('expense');
  const html = `
    <form id="budget-form">
      <div class="form-group">
        <div class="cat-label-row">
          <label class="form-label" for="bud-cat" style="margin:0;">Cakupan Anggaran</label>
          ${!existing ? `<button type="button" id="btn-bud-add-cat" class="cat-inline-add">+ Tambah Kategori</button>` : ''}
        </div>
        <select id="bud-cat" class="neu-select" ${existing ? 'disabled' : ''}>
          <option value="ALL" ${existing?.category_id === 'ALL' ? 'selected' : ''}>Anggaran Bulanan Keseluruhan</option>
          ${expenseCats.map((c) => `<option value="${esc(c.category_id)}" ${existing?.category_id === c.category_id ? 'selected' : ''}>Kategori: ${esc(c.category_name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bulan</label>
          <select id="bud-month" class="neu-select">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<option value="${m}" ${(existing?.month || budgetState.month) === m ? 'selected' : ''}>${monthNameID(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tahun</label>
          <input type="number" id="bud-year" class="neu-input" value="${existing?.year || budgetState.year}" min="2020" max="2035" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Batas Anggaran (Rp)</label>
        <input type="number" id="bud-limit" class="neu-input tabular" min="1" value="${existing ? Number(existing.limit_amount) : ''}" placeholder="Contoh: 1500000" required />
      </div>
      <div style="display:flex;gap:10px;">
        ${existing ? `<button type="button" id="btn-del-bud" class="btn-glass-danger">${icon('trash')} Hapus</button>` : ''}
        <button type="submit" class="btn-glass-primary" style="flex:1;">Simpan Anggaran</button>
      </div>
    </form>
  `;

  openModal(existing ? 'Ubah Anggaran' : 'Buat Anggaran Bulanan', html, (rootEl, close) => {
    if (!existing) {
      wireCategorySelectWithAdd({
        selectEl: rootEl.querySelector('#bud-cat'),
        addBtnEl: rootEl.querySelector('#btn-bud-add-cat'),
        getType: () => 'expense',
        lockType: true,
        prefixOptionsHtml: `<option value="ALL">Anggaran Bulanan Keseluruhan</option>`,
        optionLabelPrefix: 'Kategori: '
      });
    }

    rootEl.querySelector('#btn-del-bud')?.addEventListener('click', () => {
      db.deleteBudget(existing.budget_id);
      showToast('Anggaran dihapus.', 'info');
      close();
      if (onSaved) onSaved();
    });

    rootEl.querySelector('#budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        db.saveBudget({
          budget_id: existing?.budget_id || null,
          category_id: existing ? existing.category_id : rootEl.querySelector('#bud-cat').value,
          month: Number(rootEl.querySelector('#bud-month').value),
          year: Number(rootEl.querySelector('#bud-year').value),
          limit_amount: Number(rootEl.querySelector('#bud-limit').value)
        });
        showToast('Anggaran berhasil disimpan.', 'success');
        close();
        if (onSaved) onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export function renderAnggaran(container, ctx) {
  const budgets = db.getBudgets(budgetState.month, budgetState.year);
  const allBudgets = db.getBudgets();
  const txs = db.getTransactions();
  const catsMap = db.getCategoryMap();

  const ymPrefix = `${budgetState.year}-${String(budgetState.month).padStart(2, '0')}`;
  const monthExpenses = txs.filter((t) => t.transaction_type === 'expense' && (t.transaction_date || '').startsWith(ymPrefix));
  const totalMonthSpent = monthExpenses.reduce((a, t) => a + Number(t.amount), 0);

  const overallBudget = budgets.find((b) => b.category_id === 'ALL');
  const categoryBudgets = budgets.filter((b) => b.category_id !== 'ALL');

  // Data perbandingan 4 bulan terakhir (Grafik)
  const compLabels = [];
  const compLimits = [];
  const compSpent = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(budgetState.year, budgetState.month - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const pfx = `${y}-${String(m).padStart(2, '0')}`;
    compLabels.push(`${monthNameID(m).slice(0, 3)} ${String(y).slice(2)}`);

    const mBudAll = allBudgets.find((b) => Number(b.month) === m && Number(b.year) === y && b.category_id === 'ALL');
    const mBudCats = allBudgets.filter((b) => Number(b.month) === m && Number(b.year) === y && b.category_id !== 'ALL');
    const limitVal = mBudAll
      ? Number(mBudAll.limit_amount)
      : mBudCats.reduce((a, b) => a + Number(b.limit_amount || 0), 0);

    const spentVal = txs
      .filter((t) => t.transaction_type === 'expense' && (t.transaction_date || '').startsWith(pfx))
      .reduce((a, t) => a + Number(t.amount || 0), 0);

    compLimits.push(limitVal);
    compSpent.push(spentVal);
  }

  const warnPct = db.getBudgetWarnPct();
  const renderBudgetCard = (b, spentAmount, title) => {
    const limit = Number(b.limit_amount || 1);
    const pct = Math.round((spentAmount / limit) * 100);
    const clampedPct = Math.min(100, pct);
    const remaining = limit - spentAmount;
    const statusBadge =
      pct >= 100
        ? '<span class="badge badge-danger">Melebihi 100%</span>'
        : pct >= warnPct
        ? `<span class="badge badge-warn">Peringatan ≥${warnPct}%</span>`
        : '<span class="badge badge-emerald">Aman</span>';
    const barCls = pct >= 100 ? 'danger' : pct >= warnPct ? 'warn' : '';

    return `
      <div class="neu-card-sm" data-edit-budget="${esc(b.budget_id)}" style="cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-size:13.5px;font-weight:800;color:var(--navy);">${esc(title)}</div>
          ${statusBadge}
        </div>
        <div class="neu-progress-track" style="margin-bottom:8px;">
          <div class="neu-progress-fill ${barCls}" style="width:${clampedPct}%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;">
          <span class="tabular text-muted">Terpakai ${formatRp(spentAmount)} (${pct}%)</span>
          <span class="tabular ${remaining < 0 ? 'text-danger' : 'text-emerald'}">
            ${remaining < 0 ? `Lebih ${formatRp(Math.abs(remaining))}` : `Sisa ${formatRp(remaining)}`}
          </span>
        </div>
        <div style="font-size:11px;color:var(--slate-soft);margin-top:3px;">Batas: ${formatRp(limit)}</div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="neu-card">
      <div class="section-head">
        <button type="button" id="bud-prev" class="btn-glass-icon">${icon('chevronLeft')}</button>
        <div style="text-align:center;">
          <h2 class="section-title">Anggaran ${monthNameID(budgetState.month)} ${budgetState.year}</h2>
          <p class="section-subtitle">Total Realisasi: ${formatRp(totalMonthSpent)}</p>
        </div>
        <button type="button" id="bud-next" class="btn-glass-icon">${icon('chevronRight')}</button>
      </div>
      <button type="button" id="btn-new-budget" class="btn-glass-primary btn-block btn-sm">+ Atur Anggaran Bulan Ini</button>
    </div>

    ${overallBudget ? `
      <div class="neu-card">
        <div class="section-head">
          <h3 class="section-title">Anggaran Keseluruhan</h3>
          <span class="badge badge-blue">Utama</span>
        </div>
        ${renderBudgetCard(overallBudget, totalMonthSpent, 'Total Pengeluaran Bulanan')}
      </div>
    ` : ''}

    <div class="neu-card">
      <div class="section-head">
        <div>
          <h3 class="section-title">Anggaran per Kategori</h3>
          <p class="section-subtitle">Ketuk kartu untuk ubah atau hapus</p>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${categoryBudgets.length === 0
          ? `<div class="empty-state" style="padding:14px;">Belum ada anggaran kategori pada bulan ini.</div>`
          : categoryBudgets.map((b) => {
              const cat = catsMap.get(b.category_id);
              const spent = monthExpenses
                .filter((t) => t.category_id === b.category_id)
                .reduce((a, t) => a + Number(t.amount), 0);
              return renderBudgetCard(b, spent, cat?.category_name || 'Kategori');
            }).join('')}
      </div>
    </div>

    <!-- Grafik Perbandingan Antarbulan -->
    <div class="neu-card">
      <div class="section-head">
        <div>
          <h3 class="section-title">Perbandingan Anggaran Antarbulan</h3>
          <p class="section-subtitle">Batas Anggaran vs Realisasi Pengeluaran</p>
        </div>
        <span class="badge badge-navy">4 Bulan</span>
      </div>
      <div class="chart-wrap">
        <canvas id="budget-compare-chart"></canvas>
      </div>
    </div>
  `;

  renderBudgetComparisonChart(
    container.querySelector('#budget-compare-chart'),
    compLabels,
    compLimits,
    compSpent
  );

  container.querySelector('#bud-prev')?.addEventListener('click', () => {
    budgetState.month -= 1;
    if (budgetState.month < 1) {
      budgetState.month = 12;
      budgetState.year -= 1;
    }
    renderAnggaran(container, ctx);
  });

  container.querySelector('#bud-next')?.addEventListener('click', () => {
    budgetState.month += 1;
    if (budgetState.month > 12) {
      budgetState.month = 1;
      budgetState.year += 1;
    }
    renderAnggaran(container, ctx);
  });

  container.querySelector('#btn-new-budget')?.addEventListener('click', () => {
    openBudgetModal(null, () => ctx.refresh());
  });

  container.querySelectorAll('[data-edit-budget]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-edit-budget');
      const found = budgets.find((b) => b.budget_id === id);
      if (found) openBudgetModal(found, () => ctx.refresh());
    });
  });
}
