/**
 * FINTRACK — Kalender Keuangan (Bagian 5.3 Dokumen Rancangan)
 * Kalender bulanan, indikator transaksi per tanggal, ringkasan harian,
 * detail aktivitas tanggal terpilih, serta pengingat jadwal rutin & jatuh tempo hutang/piutang.
 */

import { db } from '../db.js';
import { esc, formatDateID, formatRp, icon, monthNameID, todayISO, toISODate } from '../utils.js';
import { openTransactionModal, renderTransactionRow } from './transaksi.js';

const calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  selectedDate: todayISO()
};

export function renderKalender(container, ctx) {
  const txs = db.getTransactions();
  const recurring = db.getRecurring().filter((r) => r.is_active);
  const debts = db.getDebts().filter((d) => d.status === 'active');
  const catsMap = db.getCategoryMap();
  const walletsMap = new Map(db.getWallets(true).map((w) => [w.wallet_id, w]));

  const ymPrefix = `${calState.year}-${String(calState.month).padStart(2, '0')}`;
  const firstDay = new Date(calState.year, calState.month - 1, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Senin = 0 .. Minggu = 6
  const daysInMonth = new Date(calState.year, calState.month, 0).getDate();
  const today = todayISO();

  // Indeks harian untuk bulan terpilih
  const dailyMap = new Map();
  const ensureDay = (iso) => {
    if (!dailyMap.has(iso)) dailyMap.set(iso, { inc: 0, exp: 0, txs: [], reminders: [] });
    return dailyMap.get(iso);
  };

  for (const tx of txs) {
    if (!(tx.transaction_date || '').startsWith(ymPrefix)) continue;
    const d = ensureDay(tx.transaction_date);
    d.txs.push(tx);
    if (tx.transaction_type === 'income') d.inc += Number(tx.amount);
    else if (tx.transaction_type === 'expense') d.exp += Number(tx.amount);
  }

  for (const r of recurring) {
    if (r.next_execution && r.next_execution.startsWith(ymPrefix)) {
      const d = ensureDay(r.next_execution);
      d.reminders.push({
        type: 'recurring',
        title: `Jadwal Rutin (${r.frequency}): ${catsMap.get(r.category_id)?.category_name || 'Transaksi'}`,
        amount: r.amount,
        txType: r.transaction_type
      });
    }
  }

  for (const debt of debts) {
    if (debt.due_date && debt.due_date.startsWith(ymPrefix)) {
      const d = ensureDay(debt.due_date);
      d.reminders.push({
        type: 'debt',
        title: `${debt.debt_type === 'payable' ? 'Jatuh Tempo Hutang' : 'Jatuh Tempo Piutang'}: ${debt.person_name}`,
        amount: debt.remaining_amount,
        debtType: debt.debt_type
      });
    }
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push('<div class="cal-cell empty"></div>');
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toISODate(new Date(calState.year, calState.month - 1, day));
    const info = dailyMap.get(iso);
    const hasInc = info && info.inc > 0;
    const hasExp = info && info.exp > 0;
    const hasRem = info && info.reminders.length > 0;
    const cls = ['cal-cell'];
    if (iso === today) cls.push('today');
    if (iso === calState.selectedDate) cls.push('selected');

    cells.push(`
      <button type="button" class="${cls.join(' ')}" data-cal-date="${iso}">
        <span>${day}</span>
        <span class="cal-dots">
          ${hasInc ? '<span class="cal-dot" style="background:var(--emerald);"></span>' : ''}
          ${hasExp ? '<span class="cal-dot" style="background:var(--navy);"></span>' : ''}
          ${hasRem ? '<span class="cal-dot" style="background:var(--blue);"></span>' : ''}
        </span>
      </button>
    `);
  }

  const selectedInfo = dailyMap.get(calState.selectedDate) || { inc: 0, exp: 0, txs: [], reminders: [] };
  const monthInc = Array.from(dailyMap.values()).reduce((a, d) => a + d.inc, 0);
  const monthExp = Array.from(dailyMap.values()).reduce((a, d) => a + d.exp, 0);

  container.innerHTML = `
    <div class="neu-card">
      <div class="section-head">
        <button type="button" id="cal-prev" class="btn-glass-icon" aria-label="Bulan Sebelumnya">${icon('chevronLeft')}</button>
        <div style="text-align:center;">
          <h2 class="section-title">${monthNameID(calState.month)} ${calState.year}</h2>
          <p class="section-subtitle">Masuk ${formatRp(monthInc)} • Keluar ${formatRp(monthExp)}</p>
        </div>
        <button type="button" id="cal-next" class="btn-glass-icon" aria-label="Bulan Berikutnya">${icon('chevronRight')}</button>
      </div>

      <div class="cal-weekdays">
        <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
      </div>
      <div class="cal-grid">
        ${cells.join('')}
      </div>

      <div style="display:flex;justify-content:center;gap:14px;margin-top:12px;font-size:11px;font-weight:700;color:var(--slate-soft);">
        <span style="display:inline-flex;align-items:center;gap:5px;"><span class="cal-dot" style="background:var(--emerald);width:7px;height:7px;"></span> Masuk</span>
        <span style="display:inline-flex;align-items:center;gap:5px;"><span class="cal-dot" style="background:var(--navy);width:7px;height:7px;"></span> Keluar</span>
        <span style="display:inline-flex;align-items:center;gap:5px;"><span class="cal-dot" style="background:var(--blue);width:7px;height:7px;"></span> Jadwal / Tempo</span>
      </div>
    </div>

    <!-- Detail Tanggal Terpilih -->
    <div class="neu-card">
      <div class="section-head">
        <div>
          <h3 class="section-title">${formatDateID(calState.selectedDate)}</h3>
          <p class="section-subtitle">Ringkasan aktivitas harian</p>
        </div>
        <button type="button" id="cal-add-on-date" class="btn-glass-primary btn-sm">+ Catat</button>
      </div>

      <div class="form-row" style="margin-bottom:12px;">
        <div class="neu-inset-box">
          <div style="font-size:11px;color:var(--slate-soft);font-weight:700;">Pemasukan Hari Ini</div>
          <div class="tabular text-emerald" style="font-size:14px;font-weight:800;margin-top:2px;">${formatRp(selectedInfo.inc)}</div>
        </div>
        <div class="neu-inset-box">
          <div style="font-size:11px;color:var(--slate-soft);font-weight:700;">Pengeluaran Hari Ini</div>
          <div class="tabular text-navy" style="font-size:14px;font-weight:800;margin-top:2px;">${formatRp(selectedInfo.exp)}</div>
        </div>
      </div>

      ${selectedInfo.reminders.length > 0 ? `
        <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
          ${selectedInfo.reminders.map((rem) => `
            <div class="neu-card-sm" style="border-left:4px solid var(--blue);">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span class="badge badge-blue">${rem.type === 'recurring' ? 'Jadwal Rutin' : 'Jatuh Tempo'}</span>
                <span class="tabular" style="font-weight:800;color:var(--navy);font-size:12.5px;">${formatRp(rem.amount)}</span>
              </div>
              <div style="font-size:12.5px;font-weight:700;color:var(--slate);margin-top:5px;">${esc(rem.title)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="tx-list">
        ${selectedInfo.txs.length === 0
          ? `<div class="empty-state" style="padding:14px;">Tidak ada transaksi tercatat pada tanggal ini.</div>`
          : selectedInfo.txs.map((tx) => renderTransactionRow(tx, catsMap, walletsMap)).join('')}
      </div>
    </div>
  `;

  container.querySelector('#cal-prev')?.addEventListener('click', () => {
    calState.month -= 1;
    if (calState.month < 1) {
      calState.month = 12;
      calState.year -= 1;
    }
    calState.selectedDate = `${calState.year}-${String(calState.month).padStart(2, '0')}-01`;
    renderKalender(container, ctx);
  });

  container.querySelector('#cal-next')?.addEventListener('click', () => {
    calState.month += 1;
    if (calState.month > 12) {
      calState.month = 1;
      calState.year += 1;
    }
    calState.selectedDate = `${calState.year}-${String(calState.month).padStart(2, '0')}-01`;
    renderKalender(container, ctx);
  });

  container.querySelectorAll('[data-cal-date]').forEach((cell) => {
    cell.addEventListener('click', () => {
      calState.selectedDate = cell.getAttribute('data-cal-date');
      renderKalender(container, ctx);
    });
  });

  container.querySelector('#cal-add-on-date')?.addEventListener('click', () => {
    openTransactionModal({ defaultDate: calState.selectedDate, onSaved: () => ctx.refresh() });
  });

  container.querySelectorAll('[data-tx-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-tx-id');
      const found = txs.find((t) => t.transaction_id === id);
      if (found) openTransactionModal({ existingTx: found, onSaved: () => ctx.refresh() });
    });
  });
}
