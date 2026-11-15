/**
 * FINTRACK — Google Sheets Adapter & Write-Lock Queue (Bagian 7, 8 & 11)
 * Mengimplementasikan antrean/penguncian penulisan (write lock) untuk mencegah benturan update,
 * validasi kolom sesuai 14 sheet Google Sheets, dan validasi kepemilikan `user_id`.
 */

const fs = require('fs');
const path = require('path');
const { SHEETS_SCHEMA } = require('./schema');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'fintrack_store.json');

class SheetsAdapter {
  constructor() {
    this.writeQueue = Promise.resolve();
    this.appsScriptUrl = process.env.APPS_SCRIPT_URL || '';
    this.appsScriptSecret = process.env.APPS_SCRIPT_SECRET || '';
    this.mode = this.appsScriptUrl
      ? 'google_apps_script_live'
      : process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? 'google_sheets_configured'
      : 'local_sheets_mirror';
    this.ensureStore();
  }

  ensureStore() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = {};
      for (const sheetName of Object.keys(SHEETS_SCHEMA)) {
        initial[sheetName] = [];
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  /**
   * Menjalankan operasi tulis secara berurutan (antrean mutex)
   * sesuai Bagian 11 untuk mencegah race condition pada spreadsheet.
   */
  withWriteLock(taskFn) {
    const next = this.writeQueue.then(() => taskFn());
    this.writeQueue = next.catch(() => {});
    return next;
  }

  readAll() {
    this.ensureStore();
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      for (const sheetName of Object.keys(SHEETS_SCHEMA)) {
        if (!Array.isArray(parsed[sheetName])) parsed[sheetName] = [];
      }
      return parsed;
    } catch {
      const empty = {};
      for (const sheetName of Object.keys(SHEETS_SCHEMA)) empty[sheetName] = [];
      return empty;
    }
  }

  writeAll(data) {
    this.ensureStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Mengambil seluruh data milik `user_id` tertentu (plus kategori GLOBAL).
   */
  async getUserSnapshot(userId) {
    if (this.appsScriptUrl && this.appsScriptSecret) {
      const res = await fetch(this.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          secret: this.appsScriptSecret,
          action: 'getSnapshot',
          user_id: userId
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal membaca Google Sheets via Apps Script.');
      return json.snapshot;
    }

    const store = this.readAll();
    const snapshot = {};
    for (const [sheetName, cols] of Object.entries(SHEETS_SCHEMA)) {
      const rows = store[sheetName] || [];
      snapshot[sheetName] = rows
        .filter((row) => {
          if (sheetName === 'Users') return row.user_id === userId;
          if (sheetName === 'Categories') return row.user_id === userId || row.user_id === 'GLOBAL';
          return row.user_id === userId;
        })
        .map((row) => this.normalizeRow(cols, row));
    }
    return snapshot;
  }

  /**
   * Menyimpan snapshot milik `user_id` secara atomik lewat antrean tulis.
   * Menjaga isolasi data: baris milik user lain atau GLOBAL tidak dapat diubah user ini.
   */
  async syncUserSnapshot(userId, incomingSnapshot) {
    return this.withWriteLock(async () => {
      const store = this.readAll();
      const sanitizedPayload = {};
      for (const [sheetName, cols] of Object.entries(SHEETS_SCHEMA)) {
        if (!Array.isArray(incomingSnapshot[sheetName])) continue;
        const existingOther = (store[sheetName] || []).filter((row) => row.user_id !== userId);

        const sanitizedIncoming = incomingSnapshot[sheetName]
          .filter((row) => {
            if (sheetName === 'Categories' && row.user_id === 'GLOBAL') return false;
            return true;
          })
          .map((row) => {
            const normalized = this.normalizeRow(cols, row);
            normalized.user_id = userId;
            if (sheetName === 'Users') {
              const ident = normalized.username || row?.username || row?.email || '';
              normalized.username = ident || null;
              if (ident) normalized.email = ident;
            }
            return normalized;
          });

        sanitizedPayload[sheetName] = sanitizedIncoming;
        store[sheetName] = [...existingOther, ...sanitizedIncoming];
      }
      this.writeAll(store);

      if (this.appsScriptUrl && this.appsScriptSecret) {
        const res = await fetch(this.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            secret: this.appsScriptSecret,
            action: 'syncSnapshot',
            user_id: userId,
            snapshot: sanitizedPayload
          })
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Gagal menulis ke Google Sheets via Apps Script.');
        return { ok: true, mode: 'google_apps_script_live', syncedAt: json.syncedAt, summary: json.summary };
      }

      return { ok: true, mode: 'local_sheets_mirror', syncedAt: new Date().toISOString() };
    });
  }

  normalizeRow(columns, row) {
    const out = {};
    for (const col of columns) {
      out[col] = row && row[col] !== undefined ? row[col] : null;
    }
    return out;
  }
}

module.exports = { SheetsAdapter };
