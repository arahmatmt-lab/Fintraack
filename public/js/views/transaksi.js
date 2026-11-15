/**
 * FINTRACK — Halaman Transaksi & Modal Catat/Edit Transaksi (Bagian 5.2)
 * Mendukung Pemasukan, Pengeluaran, Perpindahan Dana Antar-Dompet, Pencarian, dan Filter.
 */

import { db } from '../db.js';
import { enhanceLiquidSegmented, esc, formatDateID, formatRp, icon, openModal, showToast, todayISO } from '../utils.js';
import { mountTransactionCategoryPicker } from './categoryPicker.js';

export function openTransactionModal({ existingTx = null, defaultType = 'expense', defaultDate = null, onSaved = null } = {}) {
  const wallets = db.getWallets(false);
  const allWallets = db.getWallets(true);

  const isEdit = Boolean(existingTx);
  const isTransfer = existingTx?.transfer_group_id || defaultType === 'transfer';
  const activeType = existingTx
    ? (existingTx.transfer_group_id ? 'transfer' : existingTx.transaction_type)
    : defaultType;

  const cashWallet = wallets.find((w) => w.wallet_type === 'cash') || wallets[0];
  const nonCashWallet = wallets.find((w) => w.wallet_type !== 'cash' && w.wallet_id !== cashWallet?.wallet_id) || wallets[1] || wallets[0];

  let defaultFromId = existingTx?.wallet_id || nonCashWallet?.wallet_id || wallets[0]?.wallet_id || '';
  let pairWalletId = cashWallet?.wallet_id || wallets[1]?.wallet_id || wallets[0]?.wallet_id || '';
  if (defaultFromId === pairWalletId && wallets.length > 1) {
    pairWalletId = wallets.find((w) => w.wallet_id !== defaultFromId)?.wallet_id || pairWalletId;
  }
  if (existingTx?.transfer_group_id) {
    const allTx = db.getTransactions();
    const other = allTx.find((t) => t.transfer_group_id === existingTx.transfer_group_id && t.transaction_id !== existingTx.transaction_id);
    if (other) {
      defaultFromId = existingTx.transaction_type === 'transfer_out' ? existingTx.wallet_id : other.wallet_id;
      pairWalletId = existingTx.transaction_type === 'transfer_out' ? other.wallet_id : existingTx.wallet_id;
    }
  }

  const html = `
    <form id="tx-form">
      ${!isEdit ? `
        <div class="neu-segmented" style="margin-bottom:14px;">
          <button type="button" class="neu-seg-btn ${activeType === 'expense' ? 'active' : ''}" data-tx-type="expense">Pengeluaran</button>
          <button type="button" class="neu-seg-btn ${activeType === 'income' ? 'active' : ''}" data-tx-type="income">Pemasukan</button>
          <button type="button" class="neu-seg-btn ${activeType === 'transfer' ? 'active' : ''}" data-tx-type="transfer">Perpindahan Dana</button>
        </div>
      ` : `<div class="badge badge-blue" style="margin-bottom:12px;">Mode Edit (${activeType === 'transfer' ? 'Perpindahan Dana' : activeType === 'income' ? 'Pemasukan' : 'Pengeluaran'})</div>`}

      <input type="hidden" id="tx-type" value="${esc(activeType)}" />

      <div class="form-group">
        <label class="form-label">Nominal (Rp) *</label>
        <input type="number" id="tx-amount" class="neu-input tabular" min="1" step="1" placeholder="Contoh: 50000" value="${existingTx ? Number(existingTx.amount) : ''}" required />
      </div>

      <div id="tx-standard-fields" class="${activeType === 'transfer' ? 'hidden' : ''}">
        <div class="form-group">
          <label class="form-label">Dompet *</label>
          <select id="tx-wallet" class="neu-select">
            ${(isEdit ? allWallets : wallets).map((w) => `<option value="${esc(w.wallet_id)}" ${existingTx?.wallet_id === w.wallet_id ? 'selected' : ''}>${esc(w.wallet_name)}</option>`).join('')}
          </select>
        </div>
        <input type="hidden" id="tx-category" value="${esc(existingTx?.category_id || '')}" />
        <div class="form-group" id="tx-cat-picker-host"></div>
      </div>

      <div id="tx-transfer-fields" class="${activeType === 'transfer' ? '' : 'hidden'}">
        ${!isEdit && wallets.length > 1 ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
            <button type="button" class="glass-pill" data-trf-preset="withdraw">Tarik Tunai (Bank → Tunai)</button>
            <button type="button" class="glass-pill" data-trf-preset="deposit">Setor Tunai (Tunai → Bank)</button>
            <button type="button" id="btn-swap-trf" class="glass-pill" title="Tukar Dompet Asal & Tujuan">${icon('swap')} Tukar</button>
          </div>
        ` : ''}
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dari Dompet</label>
            <select id="tx-from-wallet" class="neu-select" ${isEdit ? 'disabled' : ''}>
              ${wallets.map((w) => `<option value="${esc(w.wallet_id)}" ${defaultFromId === w.wallet_id ? 'selected' : ''}>${esc(w.wallet_name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ke Dompet</label>
            <select id="tx-to-wallet" class="neu-select" ${isEdit ? 'disabled' : ''}>
              ${wallets.map((w) => `<option value="${esc(w.wallet_id)}" ${pairWalletId === w.wallet_id ? 'selected' : ''}>${esc(w.wallet_name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Tanggal *</label>
        <input type="date" id="tx-date" class="neu-input" value="${esc(existingTx?.transaction_date || defaultDate || todayISO())}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Keterangan</label>
        <input type="text" id="tx-desc" class="neu-input" placeholder="Misal: Makan siang, gaji, atau tarik tunai" value="${esc(existingTx?.description || '')}" />
      </div>

      <div style="display:flex;gap:10px;margin-top:6px;">
        ${isEdit ? `<button type="button" id="btn-del-tx" class="btn-glass-danger" style="flex:0 0 auto;">${icon('trash')} Hapus</button>` : ''}
        <button type="submit" class="btn-glass-primary" style="flex:1;">
          ${isEdit ? 'Simpan Perubahan' : 'Catat Transaksi'}
        </button>
      </div>
    </form>
  `;

  openModal(isEdit ? 'Edit Transaksi' : 'Catat Transaksi', html, (rootEl, close) => {
    const typeInput = rootEl.querySelector('#tx-type');
    const stdFields = rootEl.querySelector('#tx-standard-fields');
    const trfFields = rootEl.querySelector('#tx-transfer-fields');
    const catInput = rootEl.querySelector('#tx-category');
    const catHost = rootEl.querySelector('#tx-cat-picker-host');
    const fromSelect = rootEl.querySelector('#tx-from-wallet');
    const toSelect = rootEl.querySelector('#tx-to-wallet');
    const descInput = rootEl.querySelector('#tx-desc');

    const catPicker = mountTransactionCategoryPicker({
      hostEl: catHost,
      hiddenInput: catInput,
      initialType: typeInput.value === 'income' ? 'income' : 'expense',
      initialCategoryId: existingTx?.category_id || '',
      onTypeSwitch: (nextType) => {
        const targetTab = rootEl.querySelector(`[data-tx-type="${nextType}"]`);
        if (targetTab) {
          targetTab.click();
          enhanceLiquidSegmented(rootEl);
        }
      }
    });

    rootEl.querySelectorAll('[data-tx-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-tx-type');
        typeInput.value = chosen;
        rootEl.querySelectorAll('[data-tx-type]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (chosen === 'transfer') {
          stdFields.classList.add('hidden');
          trfFields.classList.remove('hidden');
        } else {
          stdFields.classList.remove('hidden');
          trfFields.classList.add('hidden');
          catPicker.setType(chosen);
        }
      });
    });

    rootEl.querySelectorAll('[data-trf-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-trf-preset');
        if (!fromSelect || !toSelect || !cashWallet || !nonCashWallet) return;
        if (mode === 'withdraw') {
          fromSelect.value = nonCashWallet.wallet_id;
          toSelect.value = cashWallet.wallet_id;
          if (!descInput.value.trim()) descInput.placeholder = 'Misal: Tarik tunai ATM ke Dompet Tunai';
        } else {
          fromSelect.value = cashWallet.wallet_id;
          toSelect.value = nonCashWallet.wallet_id;
          if (!descInput.value.trim()) descInput.placeholder = 'Misal: Setor tunai ke Rekening Bank';
        }
      });
    });

    rootEl.querySelector('#btn-swap-trf')?.addEventListener('click', () => {
      if (!fromSelect || !toSelect) return;
      const prevFrom = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = prevFrom;
    });

    rootEl.querySelector('#btn-del-tx')?.addEventListener('click', () => {
      db.deleteTransaction(existingTx.transaction_id);
      showToast('Transaksi dihapus & saldo diperbarui.', 'info');
      close();
      if (typeof onSaved === 'function') onSaved();
    });

    rootEl.querySelector('#tx-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const txType = typeInput.value;
        const amount = Number(rootEl.querySelector('#tx-amount').value);
        const date = rootEl.querySelector('#tx-date').value;
        const desc = rootEl.querySelector('#tx-desc').value;

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Nominal transaksi harus lebih besar dari nol.');
        }

        if (isEdit) {
          db.updateTransaction(existingTx.transaction_id, {
            transaction_type: isTransfer ? existingTx.transaction_type : txType,
            wallet_id: rootEl.querySelector('#tx-wallet')?.value || existingTx.wallet_id,
            category_id: rootEl.querySelector('#tx-category')?.value || existingTx.category_id,
            amount,
            transaction_date: date,
            description: desc,
            attachment_url: existingTx.attachment_url || null
          });
          showToast('Transaksi berhasil diperbarui.', 'success');
        } else if (txType === 'transfer') {
          db.addTransaction({
            transaction_type: 'transfer',
            wallet_id: fromSelect.value,
            to_wallet_id: toSelect.value,
            amount,
            transaction_date: date,
            description: desc,
            attachment_url: null
          });
          showToast('Perpindahan dana antar-dompet berhasil dicatat.', 'success');
        } else {
          const catId = rootEl.querySelector('#tx-category').value;
          if (!catId) {
            throw new Error('Pilih atau tambahkan kategori terlebih dahulu.');
          }
          db.addTransaction({
            transaction_type: txType,
            wallet_id: rootEl.querySelector('#tx-wallet').value,
            category_id: catId,
            amount,
            transaction_date: date,
            description: desc,
            attachment_url: null
          });
          showToast('Transaksi berhasil dicatat.', 'success');
        }

        close();
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

const filterState = {
  search: '',
  type: 'all',
  wallet: 'all',
  category: 'all'
};

export function renderTransaksi(container, ctx) {
  const txs = db.getTransactions();
  const wallets = db.getWallets(true);
  const categories = db.getCategories();
  const walletsMap = new Map(wallets.map((w) => [w.wallet_id, w]));
  const catsMap = db.getCategoryMap();
  if (filterState.category !== 'all' && !categories.some((c) => c.category_id === filterState.category)) {
    filterState.category = 'all';
  }

  const filtered = txs.filter((tx) => {
    if (filterState.type !== 'all') {
      if (filterState.type === 'transfer') {
        if (!tx.transfer_group_id) return false;
      } else if (tx.transaction_type !== filterState.type) {
        return false;
      }
    }
    if (filterState.wallet !== 'all' && tx.wallet_id !== filterState.wallet) return false;
    if (filterState.category !== 'all' && tx.category_id !== filterState.category) return false;
    if (filterState.search.trim()) {
      const q = filterState.search.trim().toLowerCase();
      const catName = (catsMap.get(tx.category_id)?.category_name || '').toLowerCase();
      const walName = (walletsMap.get(tx.wallet_id)?.wallet_name || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      if (!desc.includes(q) && !catName.includes(q) && !walName.includes(q)) return false;
    }
    return true;
  });

  // Hitung ringkasan filter (tidak memasukkan transfer ke pemasukan/pengeluaran)
  const incSum = filtered.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const expSum = filtered.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  container.innerHTML = `
    <div class="neu-card">
      <div class="section-head">
        <div>
          <h2 class="section-title">Riwayat Transaksi</h2>
          <p class="section-subtitle">${filtered.length} catatan ditemukan</p>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" id="tx-btn-scan" class="btn-glass btn-sm">${icon('scan')} Struk</button>
          <button type="button" id="tx-btn-add" class="btn-glass-primary btn-sm">+ Catat</button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:10px;">
        <input type="search" id="tx-search" class="neu-input" placeholder="Cari keterangan, kategori, atau dompet..." value="${esc(filterState.search)}" />
      </div>

      <div class="neu-segmented" style="margin-bottom:10px;">
        <button type="button" class="neu-seg-btn ${filterState.type === 'all' ? 'active' : ''}" data-ftype="all">Semua</button>
        <button type="button" class="neu-seg-btn ${filterState.type === 'income' ? 'active' : ''}" data-ftype="income">Masuk</button>
        <button type="button" class="neu-seg-btn ${filterState.type === 'expense' ? 'active' : ''}" data-ftype="expense">Keluar</button>
        <button type="button" class="neu-seg-btn ${filterState.type === 'transfer' ? 'active' : ''}" data-ftype="transfer">Pindah Dana</button>
      </div>

      <div class="form-row">
        <select id="tx-filter-wallet" class="neu-select" style="font-size:12px;padding:9px 10px;">
          <option value="all">Semua Dompet</option>
          ${wallets.map((w) => `<option value="${esc(w.wallet_id)}" ${filterState.wallet === w.wallet_id ? 'selected' : ''}>${esc(w.wallet_name)}</option>`).join('')}
        </select>
        <select id="tx-filter-cat" class="neu-select" style="font-size:12px;padding:9px 10px;">
          <option value="all">Semua Kategori</option>
          ${categories.map((c) => `<option value="${esc(c.category_id)}" ${filterState.category === c.category_id ? 'selected' : ''}>${esc(c.category_name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="neu-card-sm">
        <div style="font-size:11px;color:var(--slate-soft);font-weight:700;">Total Pemasukan</div>
        <div class="tabular text-emerald" style="font-size:14.5px;font-weight:800;margin-top:3px;">${formatRp(incSum)}</div>
      </div>
      <div class="neu-card-sm">
        <div style="font-size:11px;color:var(--slate-soft);font-weight:700;">Total Pengeluaran</div>
        <div class="tabular text-navy" style="font-size:14.5px;font-weight:800;margin-top:3px;">${formatRp(expSum)}</div>
      </div>
    </div>

    <div class="tx-list" id="tx-items-container">
      ${filtered.length === 0 ? `
        <div class="neu-card empty-state">Belum ada transaksi sesuai filter.</div>
      ` : filtered.map((tx) => renderTransactionRow(tx, catsMap, walletsMap)).join('')}
    </div>
  `;

  container.querySelector('#tx-btn-add')?.addEventListener('click', () => {
    openTransactionModal({ onSaved: () => ctx.refresh() });
  });
  container.querySelector('#tx-btn-scan')?.addEventListener('click', () => {
    ctx.openScanner();
  });

  container.querySelector('#tx-search')?.addEventListener('input', (e) => {
    filterState.search = e.target.value;
    renderTransaksi(container, ctx);
    const inp = container.querySelector('#tx-search');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  });

  container.querySelectorAll('[data-ftype]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.type = btn.getAttribute('data-ftype');
      renderTransaksi(container, ctx);
    });
  });

  container.querySelector('#tx-filter-wallet')?.addEventListener('change', (e) => {
    filterState.wallet = e.target.value;
    renderTransaksi(container, ctx);
  });

  container.querySelector('#tx-filter-cat')?.addEventListener('change', (e) => {
    filterState.category = e.target.value;
    renderTransaksi(container, ctx);
  });

  container.querySelectorAll('[data-tx-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-tx-id');
      const found = txs.find((t) => t.transaction_id === id);
      if (found) {
        openTransactionModal({ existingTx: found, onSaved: () => ctx.refresh() });
      }
    });
  });
}

export function renderTransactionRow(tx, catsMap, walletsMap) {
  const cat = catsMap.get(tx.category_id);
  const wal = walletsMap.get(tx.wallet_id);
  const isIncome = tx.transaction_type === 'income';
  const isTransfer = tx.transaction_type === 'transfer_in' || tx.transaction_type === 'transfer_out';
  const sign = isIncome || tx.transaction_type === 'transfer_in' ? '+' : '-';
  const amountColor = isIncome ? 'text-emerald' : isTransfer ? 'text-blue' : 'text-navy';
  const badge = isTransfer
    ? `<span class="badge badge-blue">${tx.transaction_type === 'transfer_in' ? 'Dana Masuk' : 'Dana Keluar'}</span>`
    : `<span class="badge badge-navy">${esc(cat?.category_name || 'Umum')}</span>`;

  return `
    <div class="tx-item" data-tx-id="${esc(tx.transaction_id)}">
      <div class="tx-icon-box" style="color:${esc(cat?.color || '#142B4A')};">
        ${icon(isTransfer ? 'swap' : isIncome ? 'arrowDown' : cat?.icon || 'tag')}
      </div>
      <div class="tx-meta">
        <div class="tx-title">${esc(tx.description || cat?.category_name || 'Transaksi')}</div>
        <div class="tx-sub">
          ${badge}
          <span>${esc(wal?.wallet_name || '-')}</span>
          <span>• ${formatDateID(tx.transaction_date)}</span>
        </div>
      </div>
      <div class="tx-amount-col">
        <div class="tx-amount tabular ${amountColor}">${sign}${formatRp(tx.amount)}</div>
      </div>
    </div>
  `;
}
