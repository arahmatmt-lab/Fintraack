/**
 * FINTRACK — Menu Lainnya & Modul Lanjutan (Bagian 5.5–5.9, 6, 7, 8)
 * Mencakup: Dompet, Target Tabungan, Hutang & Piutang, Transaksi Rutin,
 * Laporan & Ekspor (PDF/Excel), Kategori Kustom, Profil & Pengaturan, dan 14-Sheet Inspector.
 */

import { db, SHEETS_COLUMNS } from '../db.js';
import { renderCategoryDoughnut, renderTrendChart } from '../charts.js';
import { exportReportExcel, exportReportPDF } from '../exportService.js';
import { applyThemeMode, esc, formatCompactRp, formatDateID, formatRp, getInitials, getSavedTheme, icon, monthNameID, openModal, renderSkeleton, showToast, THEME_LABELS, todayISO, toISODate } from '../utils.js';
import { openCategoryCreatorOverlay, renderCategoryBadge, wireCategorySelectWithAdd } from './categoryPicker.js';
import { renderTransactionRow } from './transaksi.js';

let reportPeriod = 'monthly'; // 'daily' | 'weekly' | 'monthly' | 'yearly'
let debtTab = 'payable'; // 'payable' | 'receivable'
let activeSheetInspect = 'Transactions';
let catFilterType = 'all';

export function renderLainnya(container, ctx, subpage = null) {
  if (!subpage) {
    renderHub(container, ctx);
    return;
  }

  const subTitles = {
    dompet: 'Dompet & Rekening',
    target: 'Target Tabungan',
    hutang: 'Hutang & Piutang',
    rutin: 'Transaksi Rutin',
    laporan: 'Laporan & Ekspor',
    kategori: 'Kategori Transaksi',
    database: 'Struktur 14 Sheet Database',
    profil: 'Profil & Pengaturan Akun'
  };

  const backBar = `
    <div style="display:flex;align-items:center;gap:10px;">
      <button type="button" id="btn-back-lainnya" class="btn-glass-icon" aria-label="Kembali">
        ${icon('chevronLeft')}
      </button>
      <div>
        <h2 class="section-title">${esc(subTitles[subpage] || 'Lainnya')}</h2>
        <p class="section-subtitle">Menu Lainnya • FINTRACK</p>
      </div>
    </div>
  `;

  container.innerHTML = `${backBar}<div id="subpage-content" style="display:flex;flex-direction:column;gap:14px;"></div>`;
  container.querySelector('#btn-back-lainnya')?.addEventListener('click', () => ctx.openSubpage(null));

  const body = container.querySelector('#subpage-content');
  if (subpage === 'dompet') renderDompetSub(body, ctx);
  else if (subpage === 'target') renderTargetSub(body, ctx);
  else if (subpage === 'hutang') renderHutangSub(body, ctx);
  else if (subpage === 'rutin') renderRutinSub(body, ctx);
  else if (subpage === 'laporan') renderLaporanSub(body, ctx);
  else if (subpage === 'kategori') renderKategoriSub(body, ctx);
  else if (subpage === 'database') renderDatabaseSub(body);
  else if (subpage === 'profil') renderProfilSub(body, ctx);
}

/* -------------------------------------------------------------------------- */
/* 1. HUB MENU LAINNYA                                                        */
/* -------------------------------------------------------------------------- */
function renderHub(container, ctx) {
  const user = db.getCurrentUser();
  const wallets = db.getWallets(false);
  const totalBal = wallets.reduce((a, w) => a + Number(w.current_balance || 0), 0);

  container.innerHTML = `
    <div class="neu-hero-card" style="padding:16px 18px;">
      <div class="profile-hero-top">
        <div class="profile-avatar-lg" style="width:46px;height:46px;border-radius:15px;font-size:16px;">
          ${esc(getInitials(user?.name))}
          <span class="profile-avatar-dot" style="width:11px;height:11px;border-width:2px;"></span>
        </div>
        <div class="profile-identity">
          <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(user?.name || 'Pengguna')}</div>
          <div style="font-size:11.5px;color:rgba(248,250,252,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(user?.username || user?.email || '')}</div>
          <div class="tabular" style="font-size:12px;font-weight:700;color:#34D399;margin-top:4px;">
            Saldo Aktif: ${formatRp(totalBal)}
          </div>
        </div>
        <button type="button" id="hub-open-profil" class="btn-glass btn-sm" style="flex-shrink:0;">Profil</button>
      </div>
    </div>

    <div class="menu-grid-2">
      <button type="button" class="menu-tile" data-sub="dompet">
        <span class="menu-tile-icon bg-grad-navy">${icon('wallet')}</span>
        <span class="menu-tile-title">Dompet</span>
        <span class="menu-tile-desc">Tunai, bank, e-wallet, saldo & riwayat per dompet</span>
      </button>

      <button type="button" class="menu-tile" data-sub="target">
        <span class="menu-tile-icon bg-grad-emerald">${icon('target')}</span>
        <span class="menu-tile-title">Target Tabungan</span>
        <span class="menu-tile-desc">Sasaran dana, setoran, penarikan & progres</span>
      </button>

      <button type="button" class="menu-tile" data-sub="hutang">
        <span class="menu-tile-icon bg-grad-blue">${icon('debt')}</span>
        <span class="menu-tile-title">Hutang & Piutang</span>
        <span class="menu-tile-desc">Pihak terkait, cicilan, pelunasan & tempo</span>
      </button>

      <button type="button" class="menu-tile" data-sub="rutin">
        <span class="menu-tile-icon bg-grad-navy">${icon('repeat')}</span>
        <span class="menu-tile-title">Transaksi Rutin</span>
        <span class="menu-tile-desc">Jadwal harian, mingguan & bulanan otomatis</span>
      </button>

      <button type="button" class="menu-tile" data-sub="laporan">
        <span class="menu-tile-icon bg-grad-blue">${icon('chart')}</span>
        <span class="menu-tile-title">Laporan & Ekspor</span>
        <span class="menu-tile-desc">Grafik periode & unduh PDF / Excel</span>
      </button>

      <button type="button" class="menu-tile" id="hub-open-scanner">
        <span class="menu-tile-icon bg-grad-emerald">${icon('scan')}</span>
        <span class="menu-tile-title">AI Receipt Scanner</span>
        <span class="menu-tile-desc">Foto struk jadi transaksi tervalidasi AI</span>
      </button>

      <button type="button" class="menu-tile" data-sub="kategori">
        <span class="menu-tile-icon bg-grad-navy">${icon('tag')}</span>
        <span class="menu-tile-title">Kategori</span>
        <span class="menu-tile-desc">Kategori bawaan GLOBAL & kategori kustom</span>
      </button>

      <button type="button" class="menu-tile" data-sub="database">
        <span class="menu-tile-icon bg-grad-blue">${icon('db')}</span>
        <span class="menu-tile-title">14 Sheet Database</span>
        <span class="menu-tile-desc">Inspeksi skema tabel Google Sheets</span>
      </button>
    </div>

    <div class="neu-card-sm" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div>
        <div style="font-size:12.5px;font-weight:800;color:var(--navy);">Keluar / Ganti Akun</div>
        <div style="font-size:11px;color:var(--slate-soft);">Setiap akun terisolasi dengan user_id terverifikasi</div>
      </div>
      <button type="button" id="hub-logout" class="btn-glass-danger btn-sm">${icon('logout')} Keluar</button>
    </div>
  `;

  container.querySelectorAll('[data-sub]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.openSubpage(btn.getAttribute('data-sub')));
  });
  container.querySelector('#hub-open-profil')?.addEventListener('click', () => ctx.openSubpage('profil'));
  container.querySelector('#hub-open-scanner')?.addEventListener('click', () => ctx.openScanner());
  container.querySelector('#hub-logout')?.addEventListener('click', () => ctx.logout());
}

/* -------------------------------------------------------------------------- */
/* 2. DOMPET (5.5)                                                            */
/* -------------------------------------------------------------------------- */
function renderDompetSub(body, ctx) {
  const wallets = db.getWallets(true);
  const active = wallets.filter((w) => w.is_active);
  const archived = wallets.filter((w) => !w.is_active);
  const allTxs = db.getTransactions();
  const catsMap = db.getCategoryMap();
  const walletsMap = new Map(wallets.map((w) => [w.wallet_id, w]));

  const openWalletForm = (existing = null) => {
    const html = `
      <form id="wallet-form">
        <div class="form-group">
          <label class="form-label">Nama Dompet / Rekening *</label>
          <input type="text" id="wal-name" class="neu-input" value="${esc(existing?.wallet_name || '')}" placeholder="Contoh: Bank Mandiri / OVO" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jenis Dompet</label>
            <select id="wal-type" class="neu-select">
              <option value="bank" ${existing?.wallet_type === 'bank' ? 'selected' : ''}>Rekening Bank</option>
              <option value="ewallet" ${existing?.wallet_type === 'ewallet' ? 'selected' : ''}>E-Wallet</option>
              <option value="cash" ${existing?.wallet_type === 'cash' ? 'selected' : ''}>Tunai</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Warna Kartu</label>
            <select id="wal-color" class="neu-select">
              <option value="#142B4A" ${existing?.color === '#142B4A' ? 'selected' : ''}>Navy (#142B4A)</option>
              <option value="#1D4ED8" ${existing?.color === '#1D4ED8' ? 'selected' : ''}>Biru (#1D4ED8)</option>
              <option value="#10B981" ${existing?.color === '#10B981' ? 'selected' : ''}>Emerald (#10B981)</option>
              <option value="#1E293B" ${existing?.color === '#1E293B' ? 'selected' : ''}>Slate (#1E293B)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Saldo Awal (Rp)</label>
          <input type="number" id="wal-init" class="neu-input tabular" value="${existing ? Number(existing.initial_balance) : 0}" required />
        </div>
        <button type="submit" class="btn-glass-primary btn-block">${existing ? 'Simpan Perubahan' : 'Tambah Dompet'}</button>
      </form>
    `;
    openModal(existing ? 'Edit Dompet' : 'Buat Dompet Baru', html, (rootEl, close) => {
      rootEl.querySelector('#wallet-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          db.saveWallet({
            wallet_id: existing?.wallet_id,
            wallet_name: rootEl.querySelector('#wal-name').value,
            wallet_type: rootEl.querySelector('#wal-type').value,
            color: rootEl.querySelector('#wal-color').value,
            initial_balance: Number(rootEl.querySelector('#wal-init').value || 0),
            is_active: existing ? existing.is_active : true
          });
          showToast('Dompet disimpan & saldo dihitung ulang.', 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  const openWalletHistory = (w) => {
    const wTxs = allTxs.filter((t) => t.wallet_id === w.wallet_id);
    const html = `
      <div class="neu-inset-box" style="margin-bottom:12px;">
        <div style="font-size:12px;color:var(--slate-soft);">Saldo Terkini • ${esc(w.wallet_type.toUpperCase())}</div>
        <div class="tabular" style="font-size:20px;font-weight:800;color:var(--navy);">${formatRp(w.current_balance)}</div>
        <div style="font-size:11px;color:var(--slate-soft);margin-top:2px;">Saldo Awal: ${formatRp(w.initial_balance)}</div>
      </div>
      <div class="tx-list">
        ${wTxs.length ? wTxs.slice(0, 20).map((t) => renderTransactionRow(t, catsMap, walletsMap)).join('') : '<div class="empty-state">Belum ada transaksi pada dompet ini.</div>'}
      </div>
    `;
    openModal(`Riwayat: ${w.wallet_name}`, html);
  };

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="badge badge-navy">${active.length} Dompet Aktif</span>
      <button type="button" id="btn-add-wallet" class="btn-glass-primary btn-sm">+ Tambah Dompet</button>
    </div>

    ${active.map((w) => `
      <div class="neu-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="wallet-dot" style="background:${esc(w.color || '#142B4A')};width:11px;height:11px;"></span>
              <span style="font-size:14.5px;font-weight:800;color:var(--navy);">${esc(w.wallet_name)}</span>
              <span class="badge badge-blue">${esc(w.wallet_type)}</span>
            </div>
            <div class="tabular" style="font-size:19px;font-weight:800;color:var(--slate);margin-top:6px;">${formatRp(w.current_balance)}</div>
            <div style="font-size:11px;color:var(--slate-soft);">Saldo awal: ${formatRp(w.initial_balance)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" class="btn-glass btn-sm" data-wal-hist="${esc(w.wallet_id)}" style="flex:1;">Riwayat</button>
          <button type="button" class="btn-glass btn-sm" data-wal-edit="${esc(w.wallet_id)}">${icon('edit')} Edit</button>
          <button type="button" class="btn-glass-danger btn-sm" data-wal-arch="${esc(w.wallet_id)}">Arsipkan</button>
        </div>
      </div>
    `).join('')}

    ${archived.length > 0 ? `
      <div class="neu-card">
        <div class="section-head"><h3 class="section-title">Dompet Diarsipkan (${archived.length})</h3></div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${archived.map((w) => `
            <div class="neu-inset-box" style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:700;color:var(--slate);">${esc(w.wallet_name)}</div>
                <div class="tabular" style="font-size:12px;color:var(--slate-soft);">${formatRp(w.current_balance)}</div>
              </div>
              <button type="button" class="btn-glass btn-sm" data-wal-arch="${esc(w.wallet_id)}">Aktifkan</button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  body.querySelector('#btn-add-wallet')?.addEventListener('click', () => openWalletForm());
  body.querySelectorAll('[data-wal-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = wallets.find((item) => item.wallet_id === btn.getAttribute('data-wal-edit'));
      if (w) openWalletForm(w);
    });
  });
  body.querySelectorAll('[data-wal-hist]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = wallets.find((item) => item.wallet_id === btn.getAttribute('data-wal-hist'));
      if (w) openWalletHistory(w);
    });
  });
  body.querySelectorAll('[data-wal-arch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      db.toggleArchiveWallet(btn.getAttribute('data-wal-arch'));
      showToast('Status arsip dompet diperbarui.', 'info');
      ctx.refresh();
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 3. TARGET TABUNGAN (5.6)                                                   */
/* -------------------------------------------------------------------------- */
function renderTargetSub(body, ctx) {
  const goals = db.getSavingsGoals();
  const wallets = db.getWallets(false);
  const activities = db.getSavingsActivities();

  const openGoalModal = () => {
    const html = `
      <form id="goal-form">
        <div class="form-group">
          <label class="form-label">Nama Target Tabungan *</label>
          <input type="text" id="g-name" class="neu-input" placeholder="Misal: Dana Pendidikan / Liburan" required />
        </div>
        <div class="form-group">
          <label class="form-label">Nominal Sasaran (Rp) *</label>
          <input type="number" id="g-target" class="neu-input tabular" min="1" placeholder="10000000" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal Mulai</label>
            <input type="date" id="g-start" class="neu-input" value="${todayISO()}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Target</label>
            <input type="date" id="g-end" class="neu-input" value="${todayISO()}" required />
          </div>
        </div>
        <button type="submit" class="btn-glass-emerald btn-block">Buat Target Tabungan</button>
      </form>
    `;
    openModal('Target Tabungan Baru', html, (rootEl, close) => {
      rootEl.querySelector('#goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          db.saveSavingsGoal({
            goal_name: rootEl.querySelector('#g-name').value,
            target_amount: Number(rootEl.querySelector('#g-target').value),
            start_date: rootEl.querySelector('#g-start').value,
            target_date: rootEl.querySelector('#g-end').value
          });
          showToast('Target tabungan dibuat!', 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  const openActivityModal = (goal, type) => {
    const isDep = type === 'deposit';
    const html = `
      <form id="sav-act-form">
        <div class="neu-inset-box" style="margin-bottom:12px;">
          <div style="font-weight:800;color:var(--navy);">${esc(goal.goal_name)}</div>
          <div style="font-size:12px;color:var(--slate-soft);">Terkumpul: ${formatRp(goal.current_amount)} / ${formatRp(goal.target_amount)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Nominal ${isDep ? 'Setoran' : 'Penarikan'} (Rp) *</label>
          <input type="number" id="sa-amt" class="neu-input tabular" min="1" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">${isDep ? 'Ambil dari Dompet' : 'Masuk ke Dompet'}</label>
            <select id="sa-wal" class="neu-select">
              ${wallets.map((w) => `<option value="${esc(w.wallet_id)}">${esc(w.wallet_name)} (${formatCompactRp(w.current_balance)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" id="sa-date" class="neu-input" value="${todayISO()}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <input type="text" id="sa-desc" class="neu-input" placeholder="Opsional" />
        </div>
        <button type="submit" class="${isDep ? 'btn-glass-emerald' : 'btn-glass-primary'} btn-block">
          Simpan ${isDep ? 'Setoran' : 'Penarikan'}
        </button>
      </form>
    `;
    openModal(isDep ? 'Setor Dana Target' : 'Tarik Dana Target', html, (rootEl, close) => {
      rootEl.querySelector('#sav-act-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          db.recordSavingsActivity({
            goal_id: goal.goal_id,
            wallet_id: rootEl.querySelector('#sa-wal').value,
            activity_type: type,
            amount: Number(rootEl.querySelector('#sa-amt').value),
            activity_date: rootEl.querySelector('#sa-date').value,
            description: rootEl.querySelector('#sa-desc').value
          });
          showToast(`${isDep ? 'Setoran' : 'Penarikan'} target berhasil dicatat.`, 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="badge badge-emerald">${goals.length} Target Tabungan</span>
      <button type="button" id="btn-add-goal" class="btn-glass-emerald btn-sm">+ Target Baru</button>
    </div>

    ${goals.length === 0 ? `<div class="neu-card empty-state">Belum ada target tabungan.</div>` : goals.map((g) => {
      const pct = Math.min(100, Math.round((Number(g.current_amount || 0) / Number(g.target_amount || 1)) * 100));
      return `
        <div class="neu-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:14.5px;font-weight:800;color:var(--navy);">${esc(g.goal_name)}</div>
            <span class="badge ${g.status === 'completed' ? 'badge-emerald' : 'badge-blue'}">
              ${g.status === 'completed' ? 'Tercapai!' : `${pct}%`}
            </span>
          </div>
          <div class="neu-progress-track" style="margin:10px 0 8px;">
            <div class="neu-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
            <span class="tabular text-emerald">${formatRp(g.current_amount)}</span>
            <span class="tabular text-muted">Target: ${formatRp(g.target_amount)}</span>
          </div>
          <div style="font-size:11px;color:var(--slate-soft);margin-top:4px;">
            Periode: ${formatDateID(g.start_date)} → ${formatDateID(g.target_date)}
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button type="button" class="btn-glass-emerald btn-sm" data-sav-dep="${esc(g.goal_id)}" style="flex:1;">+ Setor Dana</button>
            <button type="button" class="btn-glass btn-sm" data-sav-wd="${esc(g.goal_id)}" style="flex:1;">Tarik Dana</button>
          </div>
        </div>
      `;
    }).join('')}

    ${activities.length > 0 ? `
      <div class="neu-card">
        <div class="section-head"><h3 class="section-title">Aktivitas Tabungan Terbaru</h3></div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${activities.slice(0, 6).map((a) => `
            <div class="neu-inset-box" style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--navy);">${esc(a.description)}</div>
                <div style="font-size:11px;color:var(--slate-soft);">${formatDateID(a.activity_date)}</div>
              </div>
              <span class="tabular ${a.activity_type === 'deposit' ? 'text-emerald' : 'text-danger'}" style="font-weight:800;font-size:12.5px;">
                ${a.activity_type === 'deposit' ? '+' : '-'}${formatRp(a.amount)}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  body.querySelector('#btn-add-goal')?.addEventListener('click', openGoalModal);
  body.querySelectorAll('[data-sav-dep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = goals.find((item) => item.goal_id === btn.getAttribute('data-sav-dep'));
      if (g) openActivityModal(g, 'deposit');
    });
  });
  body.querySelectorAll('[data-sav-wd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = goals.find((item) => item.goal_id === btn.getAttribute('data-sav-wd'));
      if (g) openActivityModal(g, 'withdrawal');
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 4. HUTANG & PIUTANG (5.7)                                                  */
/* -------------------------------------------------------------------------- */
function renderHutangSub(body, ctx) {
  const debts = db.getDebts();
  const wallets = db.getWallets(false);
  const filtered = debts.filter((d) => d.debt_type === debtTab);

  const openDebtModal = () => {
    const html = `
      <form id="debt-form">
        <div class="form-group">
          <label class="form-label">Jenis Catatan</label>
          <select id="d-type" class="neu-select">
            <option value="payable" ${debtTab === 'payable' ? 'selected' : ''}>Hutang (Saya berhutang)</option>
            <option value="receivable" ${debtTab === 'receivable' ? 'selected' : ''}>Piutang (Orang berhutang ke saya)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nama Pihak Terkait *</label>
          <input type="text" id="d-person" class="neu-input" placeholder="Nama orang / lembaga" required />
        </div>
        <div class="form-group">
          <label class="form-label">Nominal Awal (Rp) *</label>
          <input type="number" id="d-amt" class="neu-input tabular" min="1" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal Pinjam</label>
            <input type="date" id="d-start" class="neu-input" value="${todayISO()}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Jatuh Tempo</label>
            <input type="date" id="d-due" class="neu-input" value="${todayISO()}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Keterangan</label>
          <input type="text" id="d-desc" class="neu-input" placeholder="Misal: Talangan tiket, cicilan" />
        </div>
        <button type="submit" class="btn-glass-primary btn-block">Simpan Hutang / Piutang</button>
      </form>
    `;
    openModal('Catat Hutang / Piutang', html, (rootEl, close) => {
      rootEl.querySelector('#debt-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          db.saveDebt({
            debt_type: rootEl.querySelector('#d-type').value,
            person_name: rootEl.querySelector('#d-person').value,
            principal_amount: Number(rootEl.querySelector('#d-amt').value),
            start_date: rootEl.querySelector('#d-start').value,
            due_date: rootEl.querySelector('#d-due').value,
            description: rootEl.querySelector('#d-desc').value
          });
          showToast('Catatan hutang/piutang disimpan.', 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  const openPayModal = (debt) => {
    const html = `
      <form id="dpay-form">
        <div class="neu-inset-box" style="margin-bottom:12px;">
          <div style="font-weight:800;color:var(--navy);">${esc(debt.person_name)}</div>
          <div style="font-size:12px;color:var(--slate-soft);">Sisa Tagihan: <strong class="tabular text-navy">${formatRp(debt.remaining_amount)}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label">Nominal Pembayaran / Pelunasan (Rp)</label>
          <input type="number" id="dp-amt" class="neu-input tabular" min="1" max="${Number(debt.remaining_amount)}" value="${Number(debt.remaining_amount)}" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dompet</label>
            <select id="dp-wal" class="neu-select">
              ${wallets.map((w) => `<option value="${esc(w.wallet_id)}">${esc(w.wallet_name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Bayar</label>
            <input type="date" id="dp-date" class="neu-input" value="${todayISO()}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <input type="text" id="dp-desc" class="neu-input" placeholder="Cicilan / Pelunasan" />
        </div>
        <button type="submit" class="btn-glass-emerald btn-block">Catat Pembayaran</button>
      </form>
    `;
    openModal('Pembayaran Hutang / Piutang', html, (rootEl, close) => {
      rootEl.querySelector('#dpay-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          db.recordDebtPayment({
            debt_id: debt.debt_id,
            wallet_id: rootEl.querySelector('#dp-wal').value,
            amount: Number(rootEl.querySelector('#dp-amt').value),
            payment_date: rootEl.querySelector('#dp-date').value,
            description: rootEl.querySelector('#dp-desc').value
          });
          showToast('Pembayaran dicatat & saldo dompet diperbarui.', 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div class="neu-segmented" style="flex:1;">
        <button type="button" class="neu-seg-btn ${debtTab === 'payable' ? 'active' : ''}" data-dtab="payable">Hutang</button>
        <button type="button" class="neu-seg-btn ${debtTab === 'receivable' ? 'active' : ''}" data-dtab="receivable">Piutang</button>
      </div>
      <button type="button" id="btn-add-debt" class="btn-glass-primary btn-sm">+ Catat</button>
    </div>

    ${filtered.length === 0 ? `<div class="neu-card empty-state">Belum ada catatan ${debtTab === 'payable' ? 'hutang' : 'piutang'}.</div>` : filtered.map((d) => {
      const paid = Number(d.principal_amount) - Number(d.remaining_amount);
      const pct = Math.min(100, Math.round((paid / Number(d.principal_amount || 1)) * 100));
      return `
        <div class="neu-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:14.5px;font-weight:800;color:var(--navy);">${esc(d.person_name)}</div>
              <div style="font-size:11.5px;color:var(--slate-soft);">${esc(d.description)}</div>
            </div>
            <span class="badge ${d.status === 'paid' ? 'badge-emerald' : 'badge-warn'}">${d.status === 'paid' ? 'Lunas' : 'Aktif'}</span>
          </div>
          <div class="neu-progress-track" style="margin:10px 0 8px;">
            <div class="neu-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
            <span class="tabular">Sisa: ${formatRp(d.remaining_amount)}</span>
            <span class="tabular text-muted">Awal: ${formatRp(d.principal_amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <span style="font-size:11px;color:var(--slate-soft);">Pinjam ${formatDateID(d.start_date)} • Tempo ${formatDateID(d.due_date)}</span>
            ${d.status === 'active' ? `<button type="button" class="btn-glass-emerald btn-sm" data-pay-debt="${esc(d.debt_id)}">Bayar / Lunas</button>` : ''}
          </div>
        </div>
      `;
    }).join('')}
  `;

  body.querySelectorAll('[data-dtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      debtTab = btn.getAttribute('data-dtab');
      renderHutangSub(body, ctx);
    });
  });
  body.querySelector('#btn-add-debt')?.addEventListener('click', openDebtModal);
  body.querySelectorAll('[data-pay-debt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = debts.find((item) => item.debt_id === btn.getAttribute('data-pay-debt'));
      if (d) openPayModal(d);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 5. TRANSAKSI RUTIN (5.8)                                                   */
/* -------------------------------------------------------------------------- */
function renderRutinSub(body, ctx) {
  const recs = db.getRecurring();
  const wallets = db.getWallets(false);
  const catsMap = db.getCategoryMap();
  const walletsMap = new Map(db.getWallets(true).map((w) => [w.wallet_id, w]));

  const openRecModal = () => {
    const html = `
      <form id="rec-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jenis</label>
            <select id="rec-type" class="neu-select">
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Frekuensi</label>
            <select id="rec-freq" class="neu-select">
              <option value="monthly">Bulanan</option>
              <option value="weekly">Mingguan</option>
              <option value="daily">Harian</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dompet</label>
            <select id="rec-wal" class="neu-select">
              ${wallets.map((w) => `<option value="${esc(w.wallet_id)}">${esc(w.wallet_name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <div class="cat-label-row">
              <label class="form-label" for="rec-cat" style="margin:0;">Kategori</label>
              <button type="button" id="btn-rec-add-cat" class="cat-inline-add">+ Tambah</button>
            </div>
            <select id="rec-cat" class="neu-select"></select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nominal (Rp) *</label>
          <input type="number" id="rec-amt" class="neu-input tabular" min="1" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal Mulai</label>
            <input type="date" id="rec-start" class="neu-input" value="${todayISO()}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Berakhir (Opsional)</label>
            <input type="date" id="rec-end" class="neu-input" />
          </div>
        </div>
        <button type="submit" class="btn-glass-primary btn-block">Simpan Jadwal Rutin</button>
      </form>
    `;
    openModal('Jadwal Transaksi Rutin', html, (rootEl, close) => {
      const typeSel = rootEl.querySelector('#rec-type');
      const catSel = rootEl.querySelector('#rec-cat');
      const refillRecCats = wireCategorySelectWithAdd({
        selectEl: catSel,
        addBtnEl: rootEl.querySelector('#btn-rec-add-cat'),
        getType: () => typeSel.value,
        lockType: true
      });
      typeSel.addEventListener('change', () => {
        refillRecCats();
      });

      rootEl.querySelector('#rec-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          if (!catSel.value) throw new Error('Pilih atau tambahkan kategori terlebih dahulu.');
          db.saveRecurring({
            transaction_type: typeSel.value,
            frequency: rootEl.querySelector('#rec-freq').value,
            wallet_id: rootEl.querySelector('#rec-wal').value,
            category_id: catSel.value,
            amount: Number(rootEl.querySelector('#rec-amt').value),
            start_date: rootEl.querySelector('#rec-start').value,
            end_date: rootEl.querySelector('#rec-end').value
          });
          showToast('Jadwal transaksi rutin ditambahkan.', 'success');
          close();
          ctx.refresh();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  body.innerHTML = `
    <div class="neu-card-sm">
      <div style="font-size:12px;color:var(--slate);line-height:1.45;">
        <strong>Penjadwalan Sisi Backend:</strong> Transaksi rutin diproses sesuai jadwal <code>next_execution</code> tanpa bergantung browser selalu terbuka.
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="button" id="btn-add-rec" class="btn-glass-primary btn-sm" style="flex:1;">+ Jadwal Baru</button>
        <button type="button" id="btn-run-due" class="btn-glass-emerald btn-sm">Proses Jatuh Tempo</button>
      </div>
    </div>

    ${recs.length === 0 ? `<div class="neu-card empty-state">Belum ada jadwal transaksi rutin.</div>` : recs.map((r) => `
      <div class="neu-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--navy);">${esc(catsMap.get(r.category_id)?.category_name || 'Rutin')}</div>
            <div style="font-size:11.5px;color:var(--slate-soft);">
              ${esc(walletsMap.get(r.wallet_id)?.wallet_name || '-')} • <span class="badge badge-blue">${esc(r.frequency)}</span>
            </div>
          </div>
          <label class="neu-switch">
            <input type="checkbox" data-toggle-rec="${esc(r.recurring_id)}" ${r.is_active ? 'checked' : ''} />
            <span class="neu-slider"></span>
          </label>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <div>
            <div class="tabular ${r.transaction_type === 'income' ? 'text-emerald' : 'text-navy'}" style="font-size:15px;font-weight:800;">
              ${r.transaction_type === 'income' ? '+' : '-'}${formatRp(r.amount)}
            </div>
            <div style="font-size:11px;color:var(--slate-soft);">Eksekusi berikutnya: ${formatDateID(r.next_execution)}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-glass btn-sm" data-exec-rec="${esc(r.recurring_id)}">Jalankan</button>
            <button type="button" class="btn-glass-danger btn-sm" data-del-rec="${esc(r.recurring_id)}">${icon('trash')}</button>
          </div>
        </div>
      </div>
    `).join('')}
  `;

  body.querySelector('#btn-add-rec')?.addEventListener('click', openRecModal);
  body.querySelector('#btn-run-due')?.addEventListener('click', () => {
    const count = db.processDueRecurring();
    showToast(count > 0 ? `${count} transaksi rutin diproses.` : 'Belum ada jadwal yang jatuh tempo hari ini.', 'info');
    ctx.refresh();
  });
  body.querySelectorAll('[data-toggle-rec]').forEach((chk) => {
    chk.addEventListener('change', () => {
      db.toggleRecurring(chk.getAttribute('data-toggle-rec'));
      showToast('Status jadwal rutin diperbarui.', 'info');
    });
  });
  body.querySelectorAll('[data-exec-rec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-exec-rec');
      const count = db.processDueRecurring(undefined, id);
      showToast(count > 0 ? 'Transaksi rutin berhasil dieksekusi.' : 'Jadwal nonaktif atau berakhir.', 'success');
      ctx.refresh();
    });
  });
  body.querySelectorAll('[data-del-rec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      db.deleteRecurring(btn.getAttribute('data-del-rec'));
      showToast('Jadwal rutin dihapus.', 'info');
      ctx.refresh();
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 6. LAPORAN & EKSPOR PDF / EXCEL (5.9)                                      */
/* -------------------------------------------------------------------------- */
function renderLaporanSub(body) {
  const user = db.getCurrentUser();
  const allTxs = db.getTransactions();
  const wallets = db.getWallets(true);
  const catsMap = db.getCategoryMap();
  const walletsMap = new Map(wallets.map((w) => [w.wallet_id, w]));

  const now = new Date();
  const today = todayISO();
  let startISO = today;
  let endISO = today;
  let periodLabel = 'Harian';

  if (reportPeriod === 'daily') {
    startISO = today;
    endISO = today;
    periodLabel = `Harian (${formatDateID(today)})`;
  } else if (reportPeriod === 'weekly') {
    const s = new Date(now);
    s.setDate(now.getDate() - 6);
    startISO = toISODate(s);
    endISO = today;
    periodLabel = `Mingguan (${formatDateID(startISO)} - ${formatDateID(endISO)})`;
  } else if (reportPeriod === 'monthly') {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    startISO = `${y}-${String(m).padStart(2, '0')}-01`;
    endISO = `${y}-${String(m).padStart(2, '0')}-31`;
    periodLabel = `Bulanan (${monthNameID(m)} ${y})`;
  } else {
    const y = now.getFullYear();
    startISO = `${y}-01-01`;
    endISO = `${y}-12-31`;
    periodLabel = `Tahunan (${y})`;
  }

  const periodTxs = allTxs.filter((t) => t.transaction_date >= startISO && t.transaction_date <= endISO);
  const incomeTotal = periodTxs.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const expenseTotal = periodTxs.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0);
  const netTotal = incomeTotal - expenseTotal;

  // Breakdown kategori pengeluaran
  const catAgg = new Map();
  for (const t of periodTxs) {
    if (t.transaction_type !== 'expense') continue;
    catAgg.set(t.category_id, (catAgg.get(t.category_id) || 0) + Number(t.amount));
  }
  const categorySummary = Array.from(catAgg.entries())
    .map(([cid, amount]) => ({
      name: catsMap.get(cid)?.category_name || 'Lainnya',
      color: catsMap.get(cid)?.color || '#142B4A',
      amount
    }))
    .sort((a, b) => b.amount - a.amount);

  // Perbandingan 4 periode berturut-turut untuk grafik
  const compLabels = [];
  const compInc = [];
  const compExp = [];
  if (reportPeriod === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = toISODate(d);
      compLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const sub = allTxs.filter((t) => t.transaction_date === iso);
      compInc.push(sub.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      compExp.push(sub.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
  } else if (reportPeriod === 'weekly') {
    for (let w = 3; w >= 0; w--) {
      const endD = new Date(now);
      endD.setDate(now.getDate() - w * 7);
      const startD = new Date(endD);
      startD.setDate(endD.getDate() - 6);
      const sIso = toISODate(startD);
      const eIso = toISODate(endD);
      compLabels.push(`M-${w + 1}`);
      const sub = allTxs.filter((t) => t.transaction_date >= sIso && t.transaction_date <= eIso);
      compInc.push(sub.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      compExp.push(sub.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
  } else if (reportPeriod === 'monthly') {
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pfx = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      compLabels.push(monthNameID(d.getMonth() + 1).slice(0, 3));
      const sub = allTxs.filter((t) => (t.transaction_date || '').startsWith(pfx));
      compInc.push(sub.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      compExp.push(sub.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
  } else {
    for (let yOffset = 2; yOffset >= 0; yOffset--) {
      const yr = String(now.getFullYear() - yOffset);
      compLabels.push(yr);
      const sub = allTxs.filter((t) => (t.transaction_date || '').startsWith(yr));
      compInc.push(sub.filter((t) => t.transaction_type === 'income').reduce((a, t) => a + Number(t.amount), 0));
      compExp.push(sub.filter((t) => t.transaction_type === 'expense').reduce((a, t) => a + Number(t.amount), 0));
    }
  }

  body.innerHTML = `
    <div class="neu-segmented">
      <button type="button" class="neu-seg-btn ${reportPeriod === 'daily' ? 'active' : ''}" data-rper="daily">Harian</button>
      <button type="button" class="neu-seg-btn ${reportPeriod === 'weekly' ? 'active' : ''}" data-rper="weekly">Mingguan</button>
      <button type="button" class="neu-seg-btn ${reportPeriod === 'monthly' ? 'active' : ''}" data-rper="monthly">Bulanan</button>
      <button type="button" class="neu-seg-btn ${reportPeriod === 'yearly' ? 'active' : ''}" data-rper="yearly">Tahunan</button>
    </div>

    <div class="neu-card">
      <div style="font-size:12px;font-weight:700;color:var(--slate-soft);margin-bottom:8px;">${esc(periodLabel)}</div>
      <div class="form-row">
        <div class="neu-inset-box">
          <div style="font-size:11px;color:var(--slate-soft);">Pemasukan</div>
          <div class="tabular text-emerald" style="font-size:14.5px;font-weight:800;">${formatRp(incomeTotal)}</div>
        </div>
        <div class="neu-inset-box">
          <div style="font-size:11px;color:var(--slate-soft);">Pengeluaran</div>
          <div class="tabular text-navy" style="font-size:14.5px;font-weight:800;">${formatRp(expenseTotal)}</div>
        </div>
      </div>
      <div class="neu-inset-box" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:700;color:var(--navy);">Selisih Bersih</span>
        <span class="tabular ${netTotal >= 0 ? 'text-emerald' : 'text-danger'}" style="font-size:15px;font-weight:800;">
          ${formatRp(netTotal, true)}
        </span>
      </div>

      <div style="display:flex;gap:10px;margin-top:12px;">
        <button type="button" id="btn-export-pdf" class="btn-glass-navy btn-sm" style="flex:1;">${icon('download')} Ekspor PDF</button>
        <button type="button" id="btn-export-xlsx" class="btn-glass-emerald btn-sm" style="flex:1;">${icon('download')} Ekspor Excel</button>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head">
        <h3 class="section-title">Perbandingan Arus Kas</h3>
        <span class="badge badge-blue">Grafik</span>
      </div>
      <div class="chart-wrap">
        <canvas id="report-trend-chart"></canvas>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head">
        <h3 class="section-title">Distribusi Pengeluaran Kategori</h3>
      </div>
      ${categorySummary.length ? `<div class="chart-wrap-sm"><canvas id="report-cat-chart"></canvas></div>` : `<div class="empty-state">Belum ada pengeluaran pada periode ini.</div>`}
    </div>
  `;

  renderTrendChart(body.querySelector('#report-trend-chart'), compLabels, compInc, compExp, 'bar');
  if (categorySummary.length) {
    renderCategoryDoughnut(
      body.querySelector('#report-cat-chart'),
      categorySummary.map((c) => c.name),
      categorySummary.map((c) => c.amount),
      categorySummary.map((c) => c.color)
    );
  }

  body.querySelectorAll('[data-rper]').forEach((btn) => {
    btn.addEventListener('click', () => {
      reportPeriod = btn.getAttribute('data-rper');
      renderLaporanSub(body);
    });
  });

  body.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
    try {
      exportReportPDF({
        user,
        periodLabel,
        incomeTotal,
        expenseTotal,
        netTotal,
        transactions: periodTxs,
        categoriesMap: catsMap,
        walletsMap,
        categorySummary
      });
      showToast('Laporan PDF berhasil diunduh!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  body.querySelector('#btn-export-xlsx')?.addEventListener('click', () => {
    try {
      exportReportExcel({
        user,
        periodLabel,
        incomeTotal,
        expenseTotal,
        netTotal,
        transactions: periodTxs,
        wallets,
        categoriesMap: catsMap,
        walletsMap
      });
      showToast('Laporan Excel (.xlsx) berhasil diunduh!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 7. KATEGORI KUSTOM (Bagian 8)                                              */
/* -------------------------------------------------------------------------- */
function renderKategoriSub(body, ctx) {
  const allCats = db.getCategories();
  const expCount = allCats.filter((c) => c.category_type === 'expense').length;
  const incCount = allCats.filter((c) => c.category_type === 'income').length;
  const visibleCats = catFilterType === 'all'
    ? allCats
    : allCats.filter((c) => c.category_type === catFilterType);

  body.innerHTML = `
    <div class="neu-card">
      <div class="section-head" style="margin-bottom:10px;">
        <div>
          <h3 class="section-title">Kategori Pribadi</h3>
          <p class="section-subtitle">${expCount} Pengeluaran • ${incCount} Pemasukan</p>
        </div>
        <button type="button" id="btn-cat-open-add" class="btn-glass-primary btn-sm">+ Tambah Kategori</button>
      </div>

      <div class="neu-segmented" data-seg-key="cat-manage-filter">
        <button type="button" class="neu-seg-btn ${catFilterType === 'all' ? 'active' : ''}" data-cfilter="all">Semua (${allCats.length})</button>
        <button type="button" class="neu-seg-btn ${catFilterType === 'expense' ? 'active' : ''}" data-cfilter="expense">Pengeluaran (${expCount})</button>
        <button type="button" class="neu-seg-btn ${catFilterType === 'income' ? 'active' : ''}" data-cfilter="income">Pemasukan (${incCount})</button>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head" style="margin-bottom:10px;">
        <h3 class="section-title">Daftar Kategori (${visibleCats.length})</h3>
      </div>

      ${visibleCats.length > 0 ? `
        <div class="cat-manage-list">
          ${visibleCats.map((c) => {
            const isIncome = c.category_type === 'income';
            return `
              <div class="cat-manage-card" data-cat-card="${esc(c.category_id)}">
                <div class="cat-manage-main">
                  ${renderCategoryBadge(c, 'md')}
                  <div class="cat-manage-info">
                    <div class="cat-manage-name">${esc(c.category_name)}</div>
                    <span class="badge ${isIncome ? 'badge-emerald' : 'badge-navy'}">${isIncome ? 'Pemasukan' : 'Pengeluaran'}</span>
                  </div>
                </div>
                <div class="cat-manage-actions">
                  <button type="button" class="btn-glass btn-sm cat-act-btn" data-cat-edit="${esc(c.category_id)}" aria-label="Edit ${esc(c.category_name)}" title="Edit">
                    ${icon('edit')}
                  </button>
                  <button type="button" class="btn-glass-danger btn-sm cat-act-btn" data-cat-del="${esc(c.category_id)}" aria-label="Hapus ${esc(c.category_name)}" title="Hapus">
                    ${icon('trash')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="cat-empty-card">
          <div class="cat-empty-icon">${icon('tag')}</div>
          <div class="cat-empty-copy">
            <div class="cat-empty-title">Belum ada kategori${catFilterType === 'expense' ? ' Pengeluaran' : catFilterType === 'income' ? ' Pemasukan' : ''}</div>
            <div class="cat-empty-desc">Buat kategori sendiri seperti Jajan, Makan, Transport, atau Gaji agar otomatis muncul di seluruh aplikasi.</div>
          </div>
          <button type="button" class="btn-glass-emerald btn-sm cat-empty-btn" id="btn-cat-empty-add">+ Buat Kategori Pertama</button>
        </div>
      `}
    </div>
  `;

  const openAdd = () => {
    openCategoryCreatorOverlay({
      defaultType: catFilterType === 'income' ? 'income' : 'expense',
      lockType: false,
      onSaved: () => ctx.refresh()
    });
  };

  body.querySelector('#btn-cat-open-add')?.addEventListener('click', openAdd);
  body.querySelector('#btn-cat-empty-add')?.addEventListener('click', openAdd);

  body.querySelectorAll('[data-cfilter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      catFilterType = btn.getAttribute('data-cfilter') || 'all';
      ctx.refresh();
    });
  });

  body.querySelectorAll('[data-cat-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cid = btn.getAttribute('data-cat-edit');
      const found = allCats.find((c) => c.category_id === cid);
      if (!found) return;
      openCategoryCreatorOverlay({
        existing: found,
        lockType: false,
        onSaved: () => ctx.refresh()
      });
    });
  });

  body.querySelectorAll('[data-cat-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cid = btn.getAttribute('data-cat-del');
      const found = allCats.find((c) => c.category_id === cid);
      if (!found) return;
      try {
        db.deleteCustomCategory(cid);
        showToast(`Kategori "${found.category_name}" dihapus.`, 'info');
        ctx.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 8. DATABASE 14 SHEET INSPECTOR (Bagian 7 & 8)                              */
/* -------------------------------------------------------------------------- */
function renderDatabaseSub(body) {
  const snapshot = db.getUserSnapshot();
  const sheetNames = Object.keys(SHEETS_COLUMNS);
  const cols = SHEETS_COLUMNS[activeSheetInspect] || [];
  const rows = snapshot[activeSheetInspect] || [];

  body.innerHTML = `
    <div class="neu-card">
      <p style="margin:0 0 10px;font-size:12px;color:var(--slate-soft);">
        Menampilkan ke-14 sheet skema Google Sheets FINTRACK yang terisolasi untuk <code>user_id</code> akun aktif.
      </p>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Pilih Sheet (14 Tabel)</label>
        <select id="db-sheet-select" class="neu-select">
          ${sheetNames.map((name, i) => `<option value="${esc(name)}" ${name === activeSheetInspect ? 'selected' : ''}>${i + 1}. ${esc(name)} (${(snapshot[name] || []).length} baris)</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head">
        <h3 class="section-title">${esc(activeSheetInspect)}</h3>
        <span class="badge badge-navy">${rows.length} Baris</span>
      </div>
      <div class="table-scroll neu-inset-box" style="padding:0;">
        <table class="mini-table">
          <thead>
            <tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--slate-soft);padding:14px;">Belum ada data pada sheet ini.</td></tr>`
              : rows.slice(0, 15).map((r) => `
                <tr>${cols.map((c) => `<td>${esc(String(r[c] ?? '').slice(0, 32))}</td>`).join('')}</tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  body.querySelector('#db-sheet-select')?.addEventListener('change', (e) => {
    activeSheetInspect = e.target.value;
    renderDatabaseSub(body);
  });
}

/* -------------------------------------------------------------------------- */
/* 9. PROFIL, MULTI-USER & PENGATURAN                                         */
/* -------------------------------------------------------------------------- */
function renderProfilSub(body, ctx) {
  const user = db.getCurrentUser();
  const users = db.listUsers();
  const walletsCount = db.getWallets(false).length;
  const txCount = db.getTransactions().length;
  const warnPct = db.getBudgetWarnPct();
  const initials = getInitials(user?.name);
  const joinedLabel = user?.created_at ? formatDateID(user.created_at) : '-';
  const warnOptions = [70, 80, 90];

  body.innerHTML = `
    <div class="neu-hero-card">
      <div class="profile-hero-top">
        <div class="profile-avatar-lg">
          ${esc(initials)}
          <span class="profile-avatar-dot" title="Sesi Aktif"></span>
        </div>
        <div class="profile-identity">
          <div class="profile-name">${esc(user?.name || 'Pengguna FINTRACK')}</div>
          <div class="profile-email">${esc(user?.username || user?.email || '-')}</div>
          <div class="profile-chip-row">
            <span class="hero-status-chip">Akun Aktif</span>
            <button type="button" id="btn-copy-uid" class="hero-id-chip" title="Salin User ID">
              <span>${esc(user?.user_id || '-')}</span>
              ${icon('copy')}
            </button>
          </div>
        </div>
      </div>

      <div class="hero-stats-grid">
        <div class="hero-stat-pill">
          <div class="stat-title">Dompet Aktif</div>
          <div class="stat-val tabular">${walletsCount} Dompet</div>
        </div>
        <div class="hero-stat-pill">
          <div class="stat-title">Total Transaksi</div>
          <div class="stat-val tabular">${txCount} Catatan</div>
        </div>
        <div class="hero-stat-pill">
          <div class="stat-title">Status Cloud</div>
          <div class="stat-val" id="hero-cloud-status"><span class="skeleton-shimmer skeleton-on-dark skeleton-pill" aria-hidden="true" style="display:inline-block;width:82px;height:16px;vertical-align:middle;"></span></div>
        </div>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head">
        <div class="setting-lead">
          <span class="setting-icon">${icon('sliders')}</span>
          <div>
            <h3 class="section-title">Pengaturan Akun</h3>
            <p class="section-subtitle">Preferensi notifikasi & identitas terverifikasi</p>
          </div>
        </div>
        <span class="badge badge-navy">IDR</span>
      </div>

      <div class="setting-row-stack">
        <div>
          <div class="setting-title">Tema Tampilan</div>
          <div class="setting-desc">Pilih mode Terang, Dark Mode, atau Night Mode nyaman mata.</div>
        </div>
        <div class="neu-segmented" role="group" aria-label="Tema Tampilan">
          <button type="button" class="neu-seg-btn ${getSavedTheme() === 'light' ? 'active' : ''}" data-theme-pick="light">Terang</button>
          <button type="button" class="neu-seg-btn ${getSavedTheme() === 'dark' ? 'active' : ''}" data-theme-pick="dark">Dark</button>
          <button type="button" class="neu-seg-btn ${getSavedTheme() === 'night' ? 'active' : ''}" data-theme-pick="night">Night</button>
        </div>
      </div>

      <div class="setting-row-stack">
        <div>
          <div class="setting-title">Ambang Peringatan Anggaran</div>
          <div class="setting-desc">Beri tanda & notifikasi saat pemakaian mencapai persentase batas.</div>
        </div>
        <div class="neu-segmented" role="group" aria-label="Ambang Peringatan Anggaran">
          ${warnOptions.map((pct) => `
            <button type="button" class="neu-seg-btn ${warnPct === pct ? 'active' : ''}" data-warn-pct="${pct}">
              ${pct}%
            </button>
          `).join('')}
        </div>
      </div>

      <div class="setting-row-stack">
        <div class="setting-title">Detail Identitas Akun</div>
        <div class="neu-inset-box profile-meta-grid">
          <div class="profile-meta-item">
            <div class="profile-meta-label">Username</div>
            <div class="profile-meta-value">${esc(user?.username || user?.email || '-')}</div>
          </div>
          <div class="profile-meta-item">
            <div class="profile-meta-label">Bergabung</div>
            <div class="profile-meta-value">${esc(joinedLabel)}</div>
          </div>
          <div class="profile-meta-item">
            <div class="profile-meta-label">User ID</div>
            <div class="profile-meta-value profile-meta-code">${esc(user?.user_id || '-')}</div>
          </div>
          <div class="profile-meta-item">
            <div class="profile-meta-label">Auth UID</div>
            <div class="profile-meta-value profile-meta-code">${esc(user?.auth_uid || '-')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="neu-card">
      <div class="section-head">
        <div class="setting-lead">
          <span class="setting-icon">${icon('db')}</span>
          <div>
            <h3 class="section-title">Sinkronisasi Google Sheets</h3>
            <p class="section-subtitle">14 sheet terhubung ke akun Anda</p>
          </div>
        </div>
        <span id="backend-mode-badge" class="badge badge-blue">${renderSkeleton('inline')}</span>
      </div>

      <div class="sync-action-grid">
        <button type="button" id="btn-pull-now" class="sync-tile-btn">
          <span class="sync-tile-icon bg-grad-emerald">${icon('arrowDown')}</span>
          <span class="sync-tile-title">Muat Data (Pull)</span>
          <span class="sync-tile-sub">Ambil pembaruan dari Google Sheets</span>
        </button>
        <button type="button" id="btn-sync-now" class="sync-tile-btn">
          <span class="sync-tile-icon bg-grad-blue">${icon('arrowUp')}</span>
          <span class="sync-tile-title">Kirim Data (Push)</span>
          <span class="sync-tile-sub">Simpan perubahan ke Google Sheets</span>
        </button>
      </div>
      <div id="sync-loading-slot" style="margin-top:10px;"></div>
    </div>

    <div class="neu-card">
      <details class="neu-accordion">
        <summary>
          <div class="setting-lead">
            <span class="setting-icon">${icon('shield')}</span>
            <div>
              <div class="setting-title">Opsi Lanjutan & Multi-User</div>
              <div class="setting-desc">Muat user_id khusus atau beralih akun lokal</div>
            </div>
          </div>
          <span class="accordion-chevron">${icon('chevronDown')}</span>
        </summary>

        <div class="accordion-body">
          <div>
            <div class="setting-title" style="margin-bottom:4px;">Muat User ID Khusus dari Sheets</div>
            <div class="setting-desc" style="margin-bottom:8px;">Masukkan <code>user_id</code> baris spreadsheet (contoh: <code>usr_01</code>) untuk menarik datanya.</div>
            <form id="form-load-uid" style="display:flex;gap:8px;">
              <input type="text" id="input-custom-uid" class="neu-input" placeholder="Misal: usr_01" value="${esc(user?.user_id || '')}" required style="flex:1;" />
              <button type="submit" class="btn-glass-navy btn-sm">Muat</button>
            </form>
          </div>

          <div>
            <div class="setting-title" style="margin-bottom:4px;">Daftar Akun Tersimpan (${users.length})</div>
            <div class="setting-desc" style="margin-bottom:8px;">Setiap akun memiliki dompet, transaksi, anggaran, dan struk terpisah.</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${users.map((u) => {
                const isActive = u.user_id === user?.user_id;
                return `
                  <div class="account-switch-row">
                    <button type="button" class="account-switch-item ${isActive ? 'is-active' : ''}" data-switch-uid="${esc(u.user_id)}">
                      <div class="setting-lead">
                        <span class="account-avatar-sm">${esc(getInitials(u.name))}</span>
                        <div style="min-width:0;">
                          <div class="setting-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.name)}</div>
                          <div class="setting-desc" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.username || u.email)}</div>
                        </div>
                      </div>
                      ${isActive ? '<span class="badge badge-emerald">Aktif</span>' : '<span class="badge badge-blue">Masuk</span>'}
                    </button>
                    ${!isActive ? `<button type="button" class="btn-glass-danger btn-sm account-del-btn" data-remove-local-uid="${esc(u.user_id)}" title="Hapus akun dari daftar perangkat ini" aria-label="Hapus ${esc(u.name)} dari daftar perangkat">${icon('trash')}</button>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </details>
    </div>

    <div class="neu-card">
      <div class="section-head" style="margin-bottom:12px;">
        <div class="setting-lead">
          <span class="setting-icon">${icon('logout')}</span>
          <div>
            <h3 class="section-title">Sesi Akun</h3>
            <p class="section-subtitle">Keluar dari sesi akun Anda di perangkat ini</p>
          </div>
        </div>
      </div>

      <button type="button" id="btn-profil-logout" class="btn-glass-navy btn-sm btn-block">
        ${icon('logout')} Keluar ke Halaman Login
      </button>
    </div>
  `;

  fetch('/api/health')
    .then((r) => r.json())
    .then((h) => {
      const badge = body.querySelector('#backend-mode-badge');
      const heroCloud = body.querySelector('#hero-cloud-status');
      const isLive = h.storageMode === 'google_apps_script_live';
      if (badge) {
        badge.className = isLive ? 'badge badge-emerald' : 'badge badge-warn';
        badge.textContent = isLive ? 'Google Sheets Live' : (h.storageMode || 'Lokal');
      }
      if (heroCloud) {
        heroCloud.textContent = isLive ? 'Live Sheets' : 'Mode Lokal';
        heroCloud.className = `stat-val ${isLive ? 'text-emerald-bright' : ''}`;
      }
    })
    .catch(() => {
      const heroCloud = body.querySelector('#hero-cloud-status');
      if (heroCloud) heroCloud.textContent = 'Offline';
    });

  body.querySelector('#btn-copy-uid')?.addEventListener('click', async () => {
    const uid = user?.user_id || '';
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      showToast(`User ID "${uid}" disalin.`, 'success');
    } catch {
      showToast(`User ID: ${uid}`, 'info');
    }
  });

  body.querySelectorAll('[data-theme-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = btn.getAttribute('data-theme-pick');
      const applied = applyThemeMode(chosen);
      db.setSetting('theme_mode', applied);
      body.querySelectorAll('[data-theme-pick]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      showToast(`${THEME_LABELS[applied]} diaktifkan.`, 'success');
    });
  });

  body.querySelectorAll('[data-warn-pct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = btn.getAttribute('data-warn-pct');
      db.setSetting('budget_warn_pct', pct);
      body.querySelectorAll('[data-warn-pct]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      showToast(`Ambang peringatan anggaran diatur ke ${pct}%.`, 'success');
    });
  });

  body.querySelectorAll('[data-switch-uid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-switch-uid');
      db.setSessionUserId(uid);
      await db.pullFromBackend(uid);
      showToast('Berhasil beralih akun.', 'success');
      ctx.refresh();
    });
  });

  body.querySelectorAll('[data-remove-local-uid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-remove-local-uid');
      try {
        db.removeLocalUser(uid);
        showToast('Akun dihapus dari daftar perangkat ini.', 'info');
        ctx.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  const btnPull = body.querySelector('#btn-pull-now');
  const btnPush = body.querySelector('#btn-sync-now');
  const syncLoadingSlot = body.querySelector('#sync-loading-slot');

  const setSyncLoading = (active) => {
    if (!syncLoadingSlot) return;
    syncLoadingSlot.innerHTML = active ? renderSkeleton('sync') : '';
  };

  btnPull?.addEventListener('click', async () => {
    btnPull.disabled = true;
    setSyncLoading(true);
    showToast('Mengambil data terbaru dari Google Sheets...', 'info');
    try {
      const res = await db.pullFromBackend(user?.user_id, user?.username || user?.email);
      if (res?.ok && res.hasData) {
        showToast('Data berhasil dimuat dari Google Sheets!', 'success');
        ctx.refresh();
      } else if (res?.ok && !res.hasData) {
        showToast(`Tidak ada baris untuk user_id "${user?.user_id}" di Google Sheets.`, 'info');
      } else {
        showToast(res?.error || 'Gagal membaca Google Sheets.', 'error');
      }
    } finally {
      btnPull.disabled = false;
      setSyncLoading(false);
    }
  });

  body.querySelector('#form-load-uid')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = body.querySelector('#input-custom-uid').value.trim();
    if (!uid) return;
    setSyncLoading(true);
    showToast(`Mencari user_id "${uid}" di Google Sheets...`, 'info');
    try {
      const res = await db.pullFromBackend(uid);
      if (res?.ok && res.hasData) {
        showToast(`Data Google Sheets untuk "${uid}" berhasil dimuat!`, 'success');
        ctx.refresh();
      } else if (res?.ok && !res.hasData) {
        showToast(`user_id "${uid}" belum ditemukan di Google Sheets.`, 'error');
      } else {
        showToast(res?.error || 'Gagal memuat user_id.', 'error');
      }
    } finally {
      setSyncLoading(false);
    }
  });

  btnPush?.addEventListener('click', async () => {
    btnPush.disabled = true;
    setSyncLoading(true);
    showToast('Menyinkronkan ke Google Sheets...', 'info');
    try {
      const res = await db.syncToBackend();
      if (res?.ok) {
        const target = res.mode === 'google_apps_script_live' ? 'Google Sheets' : 'backend lokal';
        showToast(`14 sheet berhasil disinkronkan ke ${target}!`, 'success');
      } else {
        showToast(res?.error || 'Gagal menyinkronkan.', 'error');
      }
    } finally {
      btnPush.disabled = false;
      setSyncLoading(false);
    }
  });

  body.querySelector('#btn-profil-logout')?.addEventListener('click', () => {
    ctx.logout();
  });
}
