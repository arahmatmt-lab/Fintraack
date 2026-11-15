/**
 * FINTRACK — Multi-User 14-Sheet Data Engine (Bagian 7, 8 & 11)
 * Menyimpan & memvalidasi seluruh 14 sheet sesuai skema dokumen rancangan,
 * menjamin isolasi data per `user_id`, konsistensi saldo dompet tunggal,
 * pemrosesan transaksi rutin otomatis, dan peringatan ambang anggaran (80% & 100%).
 */

import { uuid, todayISO, toISODate, formatRp } from './utils.js';

const STORAGE_KEY = 'fintrack_db_v1';
const SESSION_KEY = 'fintrack_auth_session_v2';
const TOKEN_KEY = 'fintrack_auth_token_v2';

export const SHEETS_COLUMNS = {
  Users: ['user_id', 'name', 'username', 'auth_uid', 'photo_url', 'created_at', 'status'],
  Wallets: ['wallet_id', 'user_id', 'wallet_name', 'wallet_type', 'initial_balance', 'current_balance', 'color', 'is_active'],
  Categories: ['category_id', 'user_id', 'category_name', 'category_type', 'icon', 'color', 'is_active'],
  Transactions: [
    'transaction_id', 'user_id', 'wallet_id', 'category_id', 'transaction_type', 'amount',
    'transaction_date', 'description', 'transfer_group_id', 'attachment_url', 'created_at', 'updated_at', 'is_deleted'
  ],
  Budgets: ['budget_id', 'user_id', 'category_id', 'month', 'year', 'limit_amount', 'created_at'],
  Savings_Goals: ['goal_id', 'user_id', 'goal_name', 'target_amount', 'current_amount', 'start_date', 'target_date', 'status'],
  Savings_Activities: ['activity_id', 'user_id', 'goal_id', 'wallet_id', 'activity_type', 'amount', 'activity_date', 'description'],
  Debts: ['debt_id', 'user_id', 'debt_type', 'person_name', 'description', 'principal_amount', 'remaining_amount', 'start_date', 'due_date', 'status'],
  Debt_Payments: ['payment_id', 'user_id', 'debt_id', 'wallet_id', 'amount', 'payment_date', 'description'],
  Recurring: ['recurring_id', 'user_id', 'wallet_id', 'category_id', 'transaction_type', 'amount', 'frequency', 'start_date', 'end_date', 'next_execution', 'is_active'],
  Notifications: ['notification_id', 'user_id', 'title', 'message', 'notification_type', 'created_at', 'is_read'],
  Settings: ['setting_id', 'user_id', 'setting_key', 'setting_value'],
  Receipts: ['receipt_id', 'user_id', 'transaction_id', 'merchant_name', 'receipt_date', 'subtotal', 'tax', 'discount', 'total_amount', 'image_url', 'ai_status', 'created_at'],
  Receipt_Items: ['item_id', 'receipt_id', 'user_id', 'item_name', 'quantity', 'unit_price', 'total_price']
};

const REMOVED_PRESET_CATEGORY_IDS = new Set([
  'cat_inc_gaji',
  'cat_inc_freelance',
  'cat_inc_invest',
  'cat_inc_lain',
  'cat_exp_makan',
  'cat_exp_belanja',
  'cat_exp_transport',
  'cat_exp_tagihan',
  'cat_exp_kesehatan',
  'cat_exp_hiburan'
]);

const LEGACY_PRESET_CATEGORY_MAP = new Map([
  ['cat_inc_gaji', { category_id: 'cat_inc_gaji', category_name: 'Gaji & Tunjangan', category_type: 'income', icon: 'wallet', color: '#10B981' }],
  ['cat_inc_freelance', { category_id: 'cat_inc_freelance', category_name: 'Proyek & Freelance', category_type: 'income', icon: 'chart', color: '#1D4ED8' }],
  ['cat_inc_invest', { category_id: 'cat_inc_invest', category_name: 'Dividen & Bonus', category_type: 'income', icon: 'target', color: '#142B4A' }],
  ['cat_inc_lain', { category_id: 'cat_inc_lain', category_name: 'Pemasukan Lainnya', category_type: 'income', icon: 'plus', color: '#059669' }],
  ['cat_exp_makan', { category_id: 'cat_exp_makan', category_name: 'Makan & Minum', category_type: 'expense', icon: 'utensils', color: '#1D4ED8' }],
  ['cat_exp_belanja', { category_id: 'cat_exp_belanja', category_name: 'Belanja Kebutuhan', category_type: 'expense', icon: 'bag', color: '#142B4A' }],
  ['cat_exp_transport', { category_id: 'cat_exp_transport', category_name: 'Transportasi', category_type: 'expense', icon: 'car', color: '#1E293B' }],
  ['cat_exp_tagihan', { category_id: 'cat_exp_tagihan', category_name: 'Tagihan & Utilitas', category_type: 'expense', icon: 'bolt', color: '#2563EB' }],
  ['cat_exp_kesehatan', { category_id: 'cat_exp_kesehatan', category_name: 'Kesehatan', category_type: 'expense', icon: 'heart', color: '#10B981' }],
  ['cat_exp_hiburan', { category_id: 'cat_exp_hiburan', category_name: 'Hiburan & Gaya Hidup', category_type: 'expense', icon: 'gamepad', color: '#475569' }]
]);

const GLOBAL_CATEGORIES = [
  { category_id: 'cat_sys_transfer', user_id: 'GLOBAL', category_name: 'Perpindahan Dana', category_type: 'transfer', icon: 'swap', color: '#1D4ED8', is_active: true }
];

function createEmptyStore() {
  const store = {};
  for (const sheet of Object.keys(SHEETS_COLUMNS)) {
    store[sheet] = [];
  }
  store.Categories = [...GLOBAL_CATEGORIES];
  return store;
}

const LEGACY_DEMO_USER_IDS = new Set(['usr_andi_001']);

function stripLegacyDemoUsers(store) {
  let changed = false;
  for (const sheet of Object.keys(SHEETS_COLUMNS)) {
    const rows = Array.isArray(store[sheet]) ? store[sheet] : [];
    const filtered = rows.filter((r) => !LEGACY_DEMO_USER_IDS.has(r?.user_id));
    if (filtered.length !== rows.length) {
      store[sheet] = filtered;
      changed = true;
    }
  }
  const activeSid = localStorage.getItem(SESSION_KEY);
  if (activeSid && LEGACY_DEMO_USER_IDS.has(activeSid)) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  return changed;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const empty = createEmptyStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      return empty;
    }
    const parsed = JSON.parse(raw);
    for (const sheet of Object.keys(SHEETS_COLUMNS)) {
      if (!Array.isArray(parsed[sheet])) parsed[sheet] = [];
    }
    const prevCats = parsed.Categories;
    const cleanedCats = prevCats.filter((c) => c && !REMOVED_PRESET_CATEGORY_IDS.has(c.category_id));
    let catsChanged = cleanedCats.length !== prevCats.length;
    if (!cleanedCats.some((c) => c.category_id === 'cat_sys_transfer')) {
      cleanedCats.push(...GLOBAL_CATEGORIES);
      catsChanged = true;
    }
    parsed.Categories = cleanedCats;
    if (stripLegacyDemoUsers(parsed) || catsChanged) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    const empty = createEmptyStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function recomputeWalletBalancesInStore(store, userId) {
  const wallets = store.Wallets.filter((w) => w.user_id === userId);
  const txs = store.Transactions.filter((t) => t.user_id === userId && !t.is_deleted);
  const savActs = store.Savings_Activities.filter((a) => a.user_id === userId);
  const debtPays = store.Debt_Payments.filter((p) => p.user_id === userId);
  const debtsMap = new Map(store.Debts.filter((d) => d.user_id === userId).map((d) => [d.debt_id, d]));

  for (const w of wallets) {
    const hasTx = txs.some((t) => t.wallet_id === w.wallet_id);
    const hasSav = savActs.some((a) => a.wallet_id === w.wallet_id);
    const hasDebtPay = debtPays.some((p) => p.wallet_id === w.wallet_id);

    // Jika dompet belum punya mutasi transaksi sama sekali tetapi current_balance diisi langsung di Sheets, pertahankan nilainya
    if (!hasTx && !hasSav && !hasDebtPay && w.current_balance !== null && w.current_balance !== undefined && Number(w.initial_balance || 0) === 0 && Number(w.current_balance) !== 0) {
      w.current_balance = Number(w.current_balance);
      continue;
    }

    let bal = Number(w.initial_balance || 0);
    for (const t of txs) {
      if (t.wallet_id !== w.wallet_id) continue;
      const amt = Number(t.amount || 0);
      if (t.transaction_type === 'income' || t.transaction_type === 'transfer_in') bal += amt;
      else if (t.transaction_type === 'expense' || t.transaction_type === 'transfer_out') bal -= amt;
    }
    for (const a of savActs) {
      if (a.wallet_id !== w.wallet_id) continue;
      const amt = Number(a.amount || 0);
      if (a.activity_type === 'deposit') bal -= amt;
      else if (a.activity_type === 'withdrawal') bal += amt;
    }
    for (const p of debtPays) {
      if (p.wallet_id !== w.wallet_id) continue;
      const debt = debtsMap.get(p.debt_id);
      const amt = Number(p.amount || 0);
      if (debt?.debt_type === 'receivable') bal += amt;
      else bal -= amt;
    }
    w.current_balance = bal;
  }
}

function toBool(val, fallback = true) {
  if (typeof val === 'boolean') return val;
  if (val === null || val === undefined || val === '') return fallback;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 'yes') return true;
  return fallback;
}

function toNum(val, fallback = 0) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val === null || val === undefined || val === '') return fallback;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRemoteSheetRow(sheetName, row) {
  const r = { ...row };
  if (sheetName === 'Wallets') {
    r.initial_balance = toNum(r.initial_balance, 0);
    r.current_balance = r.current_balance !== null && r.current_balance !== '' ? toNum(r.current_balance, r.initial_balance) : r.initial_balance;
    r.is_active = toBool(r.is_active, true);
  } else if (sheetName === 'Categories') {
    r.is_active = toBool(r.is_active, true);
  } else if (sheetName === 'Transactions') {
    r.amount = toNum(r.amount, 0);
    r.is_deleted = toBool(r.is_deleted, false);
  } else if (sheetName === 'Budgets') {
    r.month = toNum(r.month, new Date().getMonth() + 1);
    r.year = toNum(r.year, new Date().getFullYear());
    r.limit_amount = toNum(r.limit_amount, 0);
  } else if (sheetName === 'Savings_Goals') {
    r.target_amount = toNum(r.target_amount, 0);
    r.current_amount = toNum(r.current_amount, 0);
  } else if (sheetName === 'Savings_Activities' || sheetName === 'Debt_Payments') {
    r.amount = toNum(r.amount, 0);
  } else if (sheetName === 'Debts') {
    r.principal_amount = toNum(r.principal_amount, 0);
    r.remaining_amount = toNum(r.remaining_amount, 0);
  } else if (sheetName === 'Recurring') {
    r.amount = toNum(r.amount, 0);
    r.is_active = toBool(r.is_active, true);
  } else if (sheetName === 'Notifications') {
    r.is_read = toBool(r.is_read, false);
  } else if (sheetName === 'Receipts') {
    r.subtotal = toNum(r.subtotal, 0);
    r.tax = toNum(r.tax, 0);
    r.discount = toNum(r.discount, 0);
    r.total_amount = toNum(r.total_amount, 0);
  } else if (sheetName === 'Receipt_Items') {
    r.quantity = toNum(r.quantity, 1);
    r.unit_price = toNum(r.unit_price, 0);
    r.total_price = toNum(r.total_price, 0);
  }
  return r;
}

export const db = {
  getSessionUserId() {
    return localStorage.getItem(SESSION_KEY) || '';
  },

  setSessionUserId(userId, token = null) {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
    if (token) localStorage.setItem(TOKEN_KEY, token);
  },

  getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },

  getCurrentUser() {
    const uid = this.getSessionUserId();
    if (!uid) return null;
    const store = loadStore();
    return store.Users.find((u) => u.user_id === uid) || null;
  },

  listUsers() {
    const store = loadStore();
    return store.Users;
  },

  async loginWithBackend({ username, email, password }) {
    const cleanIdent = String(username || email || '').trim().toLowerCase();
    const rawPass = String(password || '');
    if (!cleanIdent || !rawPass) throw new Error('Username dan kata sandi wajib diisi.');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanIdent, email: cleanIdent, password: rawPass })
    });
    const json = await res.json();
    if (!res.ok || !json.ok || !json.user) {
      throw new Error(json.error || 'Username atau kata sandi salah.');
    }

    const user = json.user;
    const store = loadStore();
    if (!store.Users.some((u) => u.user_id === user.user_id)) {
      store.Users.push({ ...user });
      saveStore(store);
    }

    this.setSessionUserId(user.user_id, json.token);
    const pullRes = await this.pullFromBackend(user.user_id, user.username || user.email);

    // Jika akun baru ini belum memiliki dompet di Google Sheets maupun lokal, buat dompet awal
    const afterStore = loadStore();
    const hasWallets = afterStore.Wallets.some((w) => w.user_id === user.user_id);
    if (!hasWallets && (!pullRes?.ok || !pullRes.hasData)) {
      afterStore.Wallets.push(
        { wallet_id: uuid('wal'), user_id: user.user_id, wallet_name: 'Dompet Tunai', wallet_type: 'cash', initial_balance: 0, current_balance: 0, color: '#10B981', is_active: true },
        { wallet_id: uuid('wal'), user_id: user.user_id, wallet_name: 'Rekening Bank', wallet_type: 'bank', initial_balance: 0, current_balance: 0, color: '#142B4A', is_active: true }
      );
      saveStore(afterStore);
      await this.syncToBackend(user);
    }

    this.processDueRecurring(user.user_id);
    return user;
  },

  async registerWithBackend({ name, username, email, password }) {
    const cleanName = String(name || '').trim();
    const cleanIdent = String(username || email || '').trim().toLowerCase();
    const rawPass = String(password || '');
    if (!cleanName || !cleanIdent) throw new Error('Nama lengkap dan username wajib diisi.');
    if (cleanIdent.length < 3) throw new Error('Username minimal 3 karakter.');
    if (rawPass.length < 6) throw new Error('Kata sandi / PIN minimal 6 karakter.');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, username: cleanIdent, email: cleanIdent, password: rawPass })
    });
    const json = await res.json();
    if (!res.ok || !json.ok || !json.user) {
      throw new Error(json.error || 'Gagal mendaftarkan akun.');
    }

    const user = json.user;
    const store = loadStore();
    if (!store.Users.some((u) => u.user_id === user.user_id)) {
      store.Users.push({ ...user });
    }
    store.Wallets.push(
      { wallet_id: uuid('wal'), user_id: user.user_id, wallet_name: 'Dompet Tunai', wallet_type: 'cash', initial_balance: 0, current_balance: 0, color: '#10B981', is_active: true },
      { wallet_id: uuid('wal'), user_id: user.user_id, wallet_name: 'Rekening Bank', wallet_type: 'bank', initial_balance: 0, current_balance: 0, color: '#142B4A', is_active: true }
    );
    store.Settings.push(
      { setting_id: uuid('set'), user_id: user.user_id, setting_key: 'budget_warn_pct', setting_value: '80' }
    );
    store.Notifications.push({
      notification_id: uuid('notif'),
      user_id: user.user_id,
      title: 'Selamat Datang di FINTRACK!',
      message: 'Akun pribadi Anda telah dibuat. Mulai catat transaksi atau pindai struk dengan AI.',
      notification_type: 'welcome',
      created_at: new Date().toISOString(),
      is_read: false
    });

    saveStore(store);
    this.setSessionUserId(user.user_id, json.token);
    await this.syncToBackend(user);
    return user;
  },

  logout() {
    this.setSessionUserId('');
  },

  // --- User-Scoped Snapshot (14 Sheets) ---
  getUserSnapshot(userId = this.getSessionUserId()) {
    const store = loadStore();
    const out = {};
    for (const sheet of Object.keys(SHEETS_COLUMNS)) {
      if (sheet === 'Categories') {
        out[sheet] = store[sheet].filter((r) => r.user_id === 'GLOBAL' || r.user_id === userId);
      } else {
        out[sheet] = store[sheet].filter((r) => r.user_id === userId);
      }
    }
    return out;
  },

  async pullFromBackend(targetUserId = this.getSessionUserId(), targetIdent = '') {
    try {
      const uid = String(targetUserId || '').trim();
      if (!uid) return { ok: false, error: 'user_id kosong.' };
      const current = this.getCurrentUser();
      const ident = targetIdent || (current && current.user_id === uid ? (current.username || current.email) : uid);

      const authRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, username: ident, email: ident, auth_uid: uid })
      });
      if (!authRes.ok) return { ok: false, error: 'Gagal otorisasi sesi backend.' };
      const { token } = await authRes.json();
      if (!token) return { ok: false, error: 'Token sesi kosong.' };

      const snapRes = await fetch('/api/sync/snapshot', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await snapRes.json();
      if (!snapRes.ok || !json.ok || !json.snapshot) {
        return { ok: false, error: json.error || 'Gagal membaca data Google Sheets.' };
      }

      const remote = json.snapshot;
      const userDataSheets = ['Users', 'Wallets', 'Transactions', 'Budgets', 'Savings_Goals', 'Debts', 'Recurring'];
      const hasUserData = userDataSheets.some((s) => Array.isArray(remote[s]) && remote[s].length > 0);
      if (!hasUserData) {
        return { ok: true, hasData: false };
      }

      const store = loadStore();
      for (const sheetName of Object.keys(SHEETS_COLUMNS)) {
        if (!Array.isArray(remote[sheetName])) continue;
        const incomingRows = remote[sheetName].map((r) => normalizeRemoteSheetRow(sheetName, r));

        if (sheetName === 'Categories') {
          const remoteGlobal = incomingRows.filter((r) => r.user_id === 'GLOBAL' && !REMOVED_PRESET_CATEGORY_IDS.has(r.category_id));
          const baseGlobal = remoteGlobal.length > 0
            ? remoteGlobal
            : [...GLOBAL_CATEGORIES];
          const otherUsersCats = store.Categories.filter((r) => r.user_id !== 'GLOBAL' && r.user_id !== uid && !REMOVED_PRESET_CATEGORY_IDS.has(r.category_id));
          const thisUserCats = incomingRows.filter((r) => r.user_id === uid && !REMOVED_PRESET_CATEGORY_IDS.has(r.category_id));
          store.Categories = [...baseGlobal, ...otherUsersCats, ...thisUserCats];
        } else if (sheetName === 'Users') {
          const prevLocal = store.Users.find((u) => u.user_id === uid);
          const others = (store.Users || []).filter((r) => r.user_id !== uid);
          const mergedUsers = incomingRows.map((r) => {
            const resolvedIdent = r.username || r.email || prevLocal?.username || prevLocal?.email || (ident && ident !== uid ? ident : '');
            return {
              ...r,
              user_id: uid,
              username: resolvedIdent,
              email: resolvedIdent
            };
          });
          store.Users = [...others, ...mergedUsers];
        } else {
          const others = (store[sheetName] || []).filter((r) => r.user_id !== uid);
          store[sheetName] = [...others, ...incomingRows.map((r) => ({ ...r, user_id: uid }))];
        }
      }

      // Pastikan profil user ada di store.Users meski user mengisi langsung sheet lain tanpa sheet Users
      if (!store.Users.some((u) => u.user_id === uid)) {
        store.Users.push({
          user_id: uid,
          name: uid,
          username: ident,
          email: ident,
          auth_uid: uid,
          photo_url: '',
          created_at: new Date().toISOString(),
          status: 'active'
        });
      }

      recomputeWalletBalancesInStore(store, uid);
      saveStore(store);
      this.setSessionUserId(uid);

      return { ok: true, hasData: true };
    } catch (err) {
      return { ok: false, error: err?.message || 'Gagal menghubungi backend.' };
    }
  },

  async syncToBackend(userObj) {
    try {
      const user = userObj || this.getCurrentUser();
      if (!user) return { ok: false, error: 'Tidak ada sesi aktif.' };
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, username: user.username || user.email, email: user.email || user.username, auth_uid: user.auth_uid })
      });
      if (!res.ok) return { ok: false, error: 'Gagal membuat token sesi.' };
      const { token } = await res.json();
      if (!token) return { ok: false, error: 'Token kosong.' };
      const syncRes = await fetch('/api/sync/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ snapshot: this.getUserSnapshot(user.user_id) })
      });
      return await syncRes.json();
    } catch (err) {
      // Offline PWA tetap berjalan lancar dari local store
      return { ok: false, error: err?.message || 'Offline' };
    }
  },

  // --- Wallets (5.5) ---
  getWallets(includeArchived = false) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Wallets.filter((w) => w.user_id === uid && (includeArchived || w.is_active));
  },

  saveWallet(data) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    if (!String(data.wallet_name || '').trim()) throw new Error('Nama dompet wajib diisi.');
    const initialBal = Number(data.initial_balance || 0);

    if (data.wallet_id) {
      const idx = store.Wallets.findIndex((w) => w.wallet_id === data.wallet_id && w.user_id === uid);
      if (idx === -1) throw new Error('Dompet tidak ditemukan.');
      store.Wallets[idx] = {
        ...store.Wallets[idx],
        wallet_name: data.wallet_name.trim(),
        wallet_type: data.wallet_type || 'bank',
        initial_balance: initialBal,
        color: data.color || '#142B4A',
        is_active: data.is_active !== false
      };
    } else {
      store.Wallets.push({
        wallet_id: uuid('wal'),
        user_id: uid,
        wallet_name: data.wallet_name.trim(),
        wallet_type: data.wallet_type || 'bank',
        initial_balance: initialBal,
        current_balance: initialBal,
        color: data.color || '#142B4A',
        is_active: true
      });
    }
    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
  },

  toggleArchiveWallet(walletId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const w = store.Wallets.find((item) => item.wallet_id === walletId && item.user_id === uid);
    if (!w) throw new Error('Dompet tidak ditemukan.');
    w.is_active = !w.is_active;
    saveStore(store);
    this.syncToBackend();
  },

  // --- Categories ---
  getCategories(type = null) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Categories.filter((c) => {
      if (REMOVED_PRESET_CATEGORY_IDS.has(c.category_id) || c.is_active === false) return false;
      if (type === 'transfer') return c.category_id === 'cat_sys_transfer' || (c.user_id === uid && c.category_type === 'transfer');
      return c.user_id === uid && c.category_id !== 'cat_sys_transfer' && (!type || c.category_type === type);
    });
  },

  getCategoryMap() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const map = new Map(LEGACY_PRESET_CATEGORY_MAP);
    for (const c of GLOBAL_CATEGORIES) {
      map.set(c.category_id, c);
    }
    for (const c of store.Categories) {
      if (c && (c.user_id === uid || c.user_id === 'GLOBAL') && !REMOVED_PRESET_CATEGORY_IDS.has(c.category_id)) {
        map.set(c.category_id, c);
      }
    }
    return map;
  },

  addCustomCategory({ category_name, category_type, icon, color }) {
    const uid = this.getSessionUserId();
    const cleanName = String(category_name || '').trim();
    if (!cleanName) throw new Error('Nama kategori wajib diisi.');
    const targetType = category_type === 'income' ? 'income' : 'expense';
    const store = loadStore();
    const duplicate = store.Categories.find(
      (c) =>
        c.user_id === uid &&
        c.is_active !== false &&
        c.category_type === targetType &&
        String(c.category_name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Kategori "${cleanName}" sudah ada di ${targetType === 'income' ? 'Pemasukan' : 'Pengeluaran'}.`);
    }
    const cat = {
      category_id: uuid('cat'),
      user_id: uid,
      category_name: cleanName,
      category_type: targetType,
      icon: icon || 'tag',
      color: color || '#1D4ED8',
      is_active: true
    };
    store.Categories.push(cat);
    saveStore(store);
    this.syncToBackend();
    return cat;
  },

  updateCustomCategory(categoryId, { category_name, category_type, icon, color }) {
    const uid = this.getSessionUserId();
    const cleanName = String(category_name || '').trim();
    if (!cleanName) throw new Error('Nama kategori wajib diisi.');
    const store = loadStore();
    const existing = store.Categories.find((c) => c.category_id === categoryId && c.user_id === uid);
    if (!existing) throw new Error('Kategori tidak ditemukan atau tidak bisa diubah.');
    const targetType = category_type === 'income' ? 'income' : category_type === 'expense' ? 'expense' : existing.category_type;
    const duplicate = store.Categories.find(
      (c) =>
        c.category_id !== categoryId &&
        c.user_id === uid &&
        c.is_active !== false &&
        c.category_type === targetType &&
        String(c.category_name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Kategori "${cleanName}" sudah ada di ${targetType === 'income' ? 'Pemasukan' : 'Pengeluaran'}.`);
    }
    existing.category_name = cleanName;
    existing.category_type = targetType;
    if (icon) existing.icon = icon;
    if (color) existing.color = color;
    saveStore(store);
    this.syncToBackend();
    return existing;
  },

  deleteCustomCategory(categoryId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const existing = store.Categories.find((c) => c.category_id === categoryId && c.user_id === uid);
    if (!existing) throw new Error('Kategori tidak ditemukan.');
    const isReferenced =
      store.Transactions.some((t) => t.user_id === uid && !t.is_deleted && t.category_id === categoryId) ||
      store.Budgets.some((b) => b.user_id === uid && b.category_id === categoryId) ||
      store.Recurring.some((r) => r.user_id === uid && r.category_id === categoryId);
    if (isReferenced) {
      existing.is_active = false;
    } else {
      store.Categories = store.Categories.filter((c) => !(c.category_id === categoryId && c.user_id === uid));
    }
    saveStore(store);
    this.syncToBackend();
  },

  // --- Transactions (5.2) ---
  getTransactions({ includeDeleted = false } = {}) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Transactions
      .filter((t) => t.user_id === uid && (includeDeleted || !t.is_deleted))
      .sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  },

  addTransaction(payload) {
    const uid = this.getSessionUserId();
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal transaksi harus lebih besar dari nol.');
    }
    const store = loadStore();
    const now = new Date().toISOString();
    const date = payload.transaction_date || todayISO();

    if (payload.transaction_type === 'transfer') {
      if (!payload.wallet_id || !payload.to_wallet_id) throw new Error('Pilih dompet asal dan dompet tujuan.');
      if (payload.wallet_id === payload.to_wallet_id) throw new Error('Dompet asal dan tujuan tidak boleh sama.');
      const groupId = uuid('trf');
      const fromW = store.Wallets.find((w) => w.wallet_id === payload.wallet_id && w.user_id === uid);
      const toW = store.Wallets.find((w) => w.wallet_id === payload.to_wallet_id && w.user_id === uid);
      const desc = payload.description?.trim() || `Transfer ${fromW?.wallet_name || ''} → ${toW?.wallet_name || ''}`;

      store.Transactions.push(
        {
          transaction_id: uuid('tx'),
          user_id: uid,
          wallet_id: payload.wallet_id,
          category_id: 'cat_sys_transfer',
          transaction_type: 'transfer_out',
          amount,
          transaction_date: date,
          description: desc,
          transfer_group_id: groupId,
          attachment_url: payload.attachment_url || null,
          created_at: now,
          updated_at: now,
          is_deleted: false
        },
        {
          transaction_id: uuid('tx'),
          user_id: uid,
          wallet_id: payload.to_wallet_id,
          category_id: 'cat_sys_transfer',
          transaction_type: 'transfer_in',
          amount,
          transaction_date: date,
          description: desc,
          transfer_group_id: groupId,
          attachment_url: payload.attachment_url || null,
          created_at: now,
          updated_at: now,
          is_deleted: false
        }
      );
    } else {
      if (!payload.wallet_id) throw new Error('Dompet wajib dipilih.');
      if (!payload.category_id) throw new Error('Kategori wajib dipilih.');
      const tx = {
        transaction_id: uuid('tx'),
        user_id: uid,
        wallet_id: payload.wallet_id,
        category_id: payload.category_id,
        transaction_type: payload.transaction_type === 'income' ? 'income' : 'expense',
        amount,
        transaction_date: date,
        description: String(payload.description || '').trim() || 'Transaksi',
        transfer_group_id: null,
        attachment_url: payload.attachment_url || null,
        created_at: now,
        updated_at: now,
        is_deleted: false
      };
      store.Transactions.push(tx);
      if (tx.transaction_type === 'expense') {
        this._checkBudgetAlertsInStore(store, uid, tx.category_id, tx.transaction_date);
      }
      recomputeWalletBalancesInStore(store, uid);
      saveStore(store);
      this.syncToBackend();
      return tx;
    }

    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
    return null;
  },

  updateTransaction(transactionId, updates) {
    const uid = this.getSessionUserId();
    const amount = Number(updates.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal transaksi harus lebih besar dari nol.');
    }
    const store = loadStore();
    const tx = store.Transactions.find((t) => t.transaction_id === transactionId && t.user_id === uid && !t.is_deleted);
    if (!tx) throw new Error('Transaksi tidak ditemukan.');

    if (tx.transfer_group_id) {
      const pair = store.Transactions.filter((t) => t.transfer_group_id === tx.transfer_group_id && t.user_id === uid);
      for (const p of pair) {
        p.amount = amount;
        p.transaction_date = updates.transaction_date || p.transaction_date;
        p.description = String(updates.description || p.description).trim();
        p.updated_at = new Date().toISOString();
      }
    } else {
      tx.wallet_id = updates.wallet_id || tx.wallet_id;
      tx.category_id = updates.category_id || tx.category_id;
      tx.transaction_type = updates.transaction_type || tx.transaction_type;
      tx.amount = amount;
      tx.transaction_date = updates.transaction_date || tx.transaction_date;
      tx.description = String(updates.description || '').trim() || tx.description;
      if (updates.attachment_url !== undefined) tx.attachment_url = updates.attachment_url;
      tx.updated_at = new Date().toISOString();
      if (tx.transaction_type === 'expense') {
        this._checkBudgetAlertsInStore(store, uid, tx.category_id, tx.transaction_date);
      }
    }

    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
  },

  deleteTransaction(transactionId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const tx = store.Transactions.find((t) => t.transaction_id === transactionId && t.user_id === uid);
    if (!tx) throw new Error('Transaksi tidak ditemukan.');

    if (tx.transfer_group_id) {
      store.Transactions.forEach((t) => {
        if (t.transfer_group_id === tx.transfer_group_id && t.user_id === uid) {
          t.is_deleted = true;
          t.updated_at = new Date().toISOString();
        }
      });
    } else {
      tx.is_deleted = true;
      tx.updated_at = new Date().toISOString();
    }

    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
  },

  // --- AI Receipt Save (Section 6 + Sheets 13 & 14) ---
  saveScannedReceipt({ transactionPayload, receiptData }) {
    const uid = this.getSessionUserId();
    const tx = this.addTransaction({
      ...transactionPayload,
      transaction_type: 'expense'
    });
    const store = loadStore();
    const receiptId = uuid('rcp');
    const now = new Date().toISOString();

    store.Receipts.push({
      receipt_id: receiptId,
      user_id: uid,
      transaction_id: tx.transaction_id,
      merchant_name: receiptData.merchant_name || 'Merchant',
      receipt_date: receiptData.receipt_date || transactionPayload.transaction_date,
      subtotal: Number(receiptData.subtotal || 0),
      tax: Number(receiptData.tax || 0),
      discount: Number(receiptData.discount || 0),
      total_amount: Number(receiptData.total_amount || transactionPayload.amount),
      image_url: receiptData.image_url || '',
      ai_status: 'confirmed_by_user',
      created_at: now
    });

    const items = Array.isArray(receiptData.items) ? receiptData.items : [];
    for (const item of items) {
      store.Receipt_Items.push({
        item_id: uuid('rcpi'),
        receipt_id: receiptId,
        user_id: uid,
        item_name: item.item_name || 'Item',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.total_price || 0)
      });
    }

    saveStore(store);
    this.syncToBackend();
    return { tx, receiptId };
  },

  // --- Budgets (5.4) ---
  getBudgets(month = null, year = null) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Budgets.filter(
      (b) => b.user_id === uid && (month === null || Number(b.month) === Number(month)) && (year === null || Number(b.year) === Number(year))
    );
  },

  saveBudget({ budget_id, category_id, month, year, limit_amount }) {
    const uid = this.getSessionUserId();
    const limit = Number(limit_amount);
    if (!Number.isFinite(limit) || limit <= 0) throw new Error('Batas anggaran harus lebih besar dari nol.');
    const store = loadStore();

    const existing = store.Budgets.find(
      (b) => b.user_id === uid && (budget_id ? b.budget_id === budget_id : (b.category_id === category_id && Number(b.month) === Number(month) && Number(b.year) === Number(year)))
    );
    if (existing) {
      existing.limit_amount = limit;
      existing.category_id = category_id;
      existing.month = Number(month);
      existing.year = Number(year);
    } else {
      store.Budgets.push({
        budget_id: uuid('bud'),
        user_id: uid,
        category_id,
        month: Number(month),
        year: Number(year),
        limit_amount: limit,
        created_at: new Date().toISOString()
      });
    }
    saveStore(store);
    this.syncToBackend();
  },

  deleteBudget(budgetId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    store.Budgets = store.Budgets.filter((b) => !(b.budget_id === budgetId && b.user_id === uid));
    saveStore(store);
    this.syncToBackend();
  },

  _checkBudgetAlertsInStore(store, uid, categoryId, isoDate) {
    const [yrStr, moStr] = String(isoDate).split('-');
    const year = Number(yrStr);
    const month = Number(moStr);
    const budgets = store.Budgets.filter(
      (b) => b.user_id === uid && Number(b.year) === year && Number(b.month) === month && (b.category_id === 'ALL' || b.category_id === categoryId)
    );
    const monthPrefix = `${yrStr}-${moStr}`;
    const monthExpenses = store.Transactions.filter(
      (t) => t.user_id === uid && !t.is_deleted && t.transaction_type === 'expense' && (t.transaction_date || '').startsWith(monthPrefix)
    );
    const catsMap = this.getCategoryMap();

    for (const b of budgets) {
      const spent = monthExpenses
        .filter((t) => b.category_id === 'ALL' || t.category_id === b.category_id)
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const pct = (spent / Number(b.limit_amount || 1)) * 100;
      const label = b.category_id === 'ALL' ? 'Anggaran Bulanan Keseluruhan' : `Anggaran ${catsMap.get(b.category_id)?.category_name || 'Kategori'}`;

      if (pct >= 100) {
        const key = `${label} (${monthPrefix}) 100%`;
        if (!store.Notifications.some((n) => n.user_id === uid && n.title.includes(label) && n.message.includes(monthPrefix) && n.notification_type === 'budget_over')) {
          store.Notifications.unshift({
            notification_id: uuid('notif'),
            user_id: uid,
            title: `${label} Melebihi 100%!`,
            message: `Periode ${monthPrefix}: terpakai ${formatRp(spent)} dari batas ${formatRp(b.limit_amount)}.`,
            notification_type: 'budget_over',
            created_at: new Date().toISOString(),
            is_read: false
          });
        }
        void key;
      } else if (pct >= this.getBudgetWarnPct(uid, store)) {
        const warnPct = this.getBudgetWarnPct(uid, store);
        if (!store.Notifications.some((n) => n.user_id === uid && n.title.includes(label) && n.message.includes(monthPrefix) && n.notification_type === 'budget_warning')) {
          store.Notifications.unshift({
            notification_id: uuid('notif'),
            user_id: uid,
            title: `${label} Mencapai ${Math.round(pct)}%`,
            message: `Periode ${monthPrefix}: penggunaan sudah melewati ambang ${warnPct}% (${formatRp(spent)} / ${formatRp(b.limit_amount)}).`,
            notification_type: 'budget_warning',
            created_at: new Date().toISOString(),
            is_read: false
          });
        }
      }
    }
  },

  // --- Savings Goals (5.6) ---
  getSavingsGoals() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Savings_Goals.filter((g) => g.user_id === uid);
  },

  getSavingsActivities(goalId = null) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Savings_Activities
      .filter((a) => a.user_id === uid && (!goalId || a.goal_id === goalId))
      .sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || ''));
  },

  saveSavingsGoal({ goal_name, target_amount, start_date, target_date }) {
    const uid = this.getSessionUserId();
    const target = Number(target_amount);
    if (!String(goal_name || '').trim()) throw new Error('Nama target tabungan wajib diisi.');
    if (!Number.isFinite(target) || target <= 0) throw new Error('Nominal sasaran harus lebih besar dari nol.');
    const store = loadStore();
    store.Savings_Goals.push({
      goal_id: uuid('goal'),
      user_id: uid,
      goal_name: goal_name.trim(),
      target_amount: target,
      current_amount: 0,
      start_date: start_date || todayISO(),
      target_date: target_date || todayISO(),
      status: 'active'
    });
    saveStore(store);
    this.syncToBackend();
  },

  recordSavingsActivity({ goal_id, wallet_id, activity_type, amount, activity_date, description }) {
    const uid = this.getSessionUserId();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Nominal harus lebih besar dari nol.');
    const store = loadStore();
    const goal = store.Savings_Goals.find((g) => g.goal_id === goal_id && g.user_id === uid);
    if (!goal) throw new Error('Target tabungan tidak ditemukan.');
    if (activity_type === 'withdrawal' && amt > Number(goal.current_amount || 0)) {
      throw new Error('Nominal penarikan melebihi dana yang terkumpul pada target.');
    }

    store.Savings_Activities.push({
      activity_id: uuid('sav'),
      user_id: uid,
      goal_id,
      wallet_id,
      activity_type,
      amount: amt,
      activity_date: activity_date || todayISO(),
      description: String(description || '').trim() || (activity_type === 'deposit' ? 'Setoran Target' : 'Penarikan Target')
    });

    goal.current_amount = activity_type === 'deposit'
      ? Number(goal.current_amount || 0) + amt
      : Number(goal.current_amount || 0) - amt;
    goal.status = Number(goal.current_amount) >= Number(goal.target_amount) ? 'completed' : 'active';

    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
  },

  // --- Debts & Receivables (5.7) ---
  getDebts() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Debts.filter((d) => d.user_id === uid);
  },

  getDebtPayments(debtId = null) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Debt_Payments
      .filter((p) => p.user_id === uid && (!debtId || p.debt_id === debtId))
      .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
  },

  saveDebt({ debt_type, person_name, description, principal_amount, start_date, due_date }) {
    const uid = this.getSessionUserId();
    const amt = Number(principal_amount);
    if (!String(person_name || '').trim()) throw new Error('Nama pihak terkait wajib diisi.');
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Nominal pokok harus lebih besar dari nol.');
    const store = loadStore();
    store.Debts.push({
      debt_id: uuid('debt'),
      user_id: uid,
      debt_type: debt_type === 'receivable' ? 'receivable' : 'payable',
      person_name: person_name.trim(),
      description: String(description || '').trim() || '-',
      principal_amount: amt,
      remaining_amount: amt,
      start_date: start_date || todayISO(),
      due_date: due_date || todayISO(),
      status: 'active'
    });
    saveStore(store);
    this.syncToBackend();
  },

  recordDebtPayment({ debt_id, wallet_id, amount, payment_date, description }) {
    const uid = this.getSessionUserId();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Nominal pembayaran harus lebih besar dari nol.');
    const store = loadStore();
    const debt = store.Debts.find((d) => d.debt_id === debt_id && d.user_id === uid);
    if (!debt) throw new Error('Data hutang/piutang tidak ditemukan.');
    if (amt > Number(debt.remaining_amount)) {
      throw new Error('Nominal pembayaran melebihi sisa tagihan.');
    }

    store.Debt_Payments.push({
      payment_id: uuid('dpay'),
      user_id: uid,
      debt_id,
      wallet_id,
      amount: amt,
      payment_date: payment_date || todayISO(),
      description: String(description || '').trim() || 'Pembayaran Hutang/Piutang'
    });

    debt.remaining_amount = Math.max(0, Number(debt.remaining_amount) - amt);
    debt.status = debt.remaining_amount === 0 ? 'paid' : 'active';

    recomputeWalletBalancesInStore(store, uid);
    saveStore(store);
    this.syncToBackend();
  },

  // --- Recurring Transactions (5.8) ---
  getRecurring() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Recurring.filter((r) => r.user_id === uid);
  },

  saveRecurring({ wallet_id, category_id, transaction_type, amount, frequency, start_date, end_date }) {
    const uid = this.getSessionUserId();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Nominal transaksi rutin harus lebih besar dari nol.');
    const start = start_date || todayISO();
    const store = loadStore();
    store.Recurring.push({
      recurring_id: uuid('rec'),
      user_id: uid,
      wallet_id,
      category_id,
      transaction_type: transaction_type === 'income' ? 'income' : 'expense',
      amount: amt,
      frequency: frequency || 'monthly',
      start_date: start,
      end_date: end_date || '',
      next_execution: start,
      is_active: true
    });
    saveStore(store);
    this.processDueRecurring(uid);
    this.syncToBackend();
  },

  toggleRecurring(recurringId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const rec = store.Recurring.find((r) => r.recurring_id === recurringId && r.user_id === uid);
    if (!rec) return;
    rec.is_active = !rec.is_active;
    saveStore(store);
    this.syncToBackend();
  },

  deleteRecurring(recurringId) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    store.Recurring = store.Recurring.filter((r) => !(r.recurring_id === recurringId && r.user_id === uid));
    saveStore(store);
    this.syncToBackend();
  },

  /**
   * Memproses jadwal transaksi rutin yang sudah jatuh tempo (Bagian 5.8).
   */
  processDueRecurring(userId = this.getSessionUserId(), forceRunId = null) {
    if (!userId) return 0;
    const store = loadStore();
    const today = todayISO();
    let executedCount = 0;

    const advanceDate = (iso, freq) => {
      const d = new Date(`${iso}T00:00:00`);
      if (freq === 'daily') d.setDate(d.getDate() + 1);
      else if (freq === 'weekly') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return toISODate(d);
    };

    const catsMap = this.getCategoryMap();

    for (const r of store.Recurring) {
      if (r.user_id !== userId || !r.is_active) continue;
      if (forceRunId && r.recurring_id !== forceRunId) continue;

      let safety = 0;
      while (
        safety < 12 &&
        (forceRunId === r.recurring_id || (r.next_execution && r.next_execution <= today)) &&
        (!r.end_date || r.next_execution <= r.end_date)
      ) {
        const execDate = forceRunId ? today : r.next_execution;
        store.Transactions.push({
          transaction_id: uuid('tx'),
          user_id: userId,
          wallet_id: r.wallet_id,
          category_id: r.category_id,
          transaction_type: r.transaction_type,
          amount: Number(r.amount),
          transaction_date: execDate,
          description: `[Rutin] ${catsMap.get(r.category_id)?.category_name || 'Transaksi Berulang'}`,
          transfer_group_id: null,
          attachment_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        });
        executedCount++;
        r.next_execution = advanceDate(execDate, r.frequency);
        if (r.end_date && r.next_execution > r.end_date) {
          r.is_active = false;
        }
        safety++;
        if (forceRunId) break;
      }
    }

    if (executedCount > 0) {
      store.Notifications.unshift({
        notification_id: uuid('notif'),
        user_id: userId,
        title: `${executedCount} Transaksi Rutin Diproses`,
        message: 'Jadwal transaksi berulang yang jatuh tempo telah dicatat otomatis ke dompet Anda.',
        notification_type: 'recurring',
        created_at: new Date().toISOString(),
        is_read: false
      });
      recomputeWalletBalancesInStore(store, userId);
      saveStore(store);
      this.syncToBackend();
    }
    return executedCount;
  },

  // --- Notifications & Settings ---
  getNotifications() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Notifications.filter((n) => n.user_id === uid);
  },

  markAllNotificationsRead() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    store.Notifications.forEach((n) => {
      if (n.user_id === uid) n.is_read = true;
    });
    saveStore(store);
  },

  getSettings() {
    const uid = this.getSessionUserId();
    const store = loadStore();
    return store.Settings.filter((s) => s.user_id === uid);
  },

  getBudgetWarnPct(userId = this.getSessionUserId(), store = loadStore()) {
    const row = store.Settings.find((s) => s.user_id === userId && s.setting_key === 'budget_warn_pct');
    const parsed = Number(row?.setting_value);
    return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : 80;
  },

  setSetting(key, value) {
    const uid = this.getSessionUserId();
    const store = loadStore();
    const existing = store.Settings.find((s) => s.user_id === uid && s.setting_key === key);
    if (existing) existing.setting_value = String(value);
    else store.Settings.push({ setting_id: uuid('set'), user_id: uid, setting_key: key, setting_value: String(value) });
    saveStore(store);
    this.syncToBackend();
  }
};
