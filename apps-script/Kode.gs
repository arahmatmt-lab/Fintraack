/**
 * ============================================================================
 * FINTRACK — Google Apps Script Web App (Kode.gs)
 * ============================================================================
 * Cara pasang:
 * 1. Di Google Spreadsheet (yang sudah berisi 14 sheet & header baris 1),
 *    buka menu: Ekstensi -> Apps Script.
 * 2. Hapus isi editor, tempel seluruh kode ini ke file Kode.gs, lalu Simpan.
 * 3. Ubah nilai FINTRACK_SECRET di bawah menjadi kode rahasia Anda sendiri.
 * 4. (Opsional) Pilih fungsi `verifyAndSeedGlobalCategories` -> klik Jalankan
 *    untuk memverifikasi ke-14 sheet & mengisi kategori GLOBAL bawaan.
 * 5. Klik Terapkan (Deploy) -> Deployment baru -> Jenis: Aplikasi web (Web app)
 *    - Jalankan sebagai (Execute as): Saya (Me)
 *    - Yang memiliki akses (Who has access): Siapa saja (Anyone)
 *    *(Keamanan tetap terjaga karena endpoint wajib mengirim `secret` &
 *     dipanggil melalui backend Node.js Anda, bukan langsung dari browser).*
 * 6. Salin URL Web App (/exec) ke environment variable `APPS_SCRIPT_URL`
 *    dan `APPS_SCRIPT_SECRET` pada server Node.js FINTRACK.
 * ============================================================================
 */

const FINTRACK_SECRET = 'GANTI_DENGAN_RAHASIA_FINTRACK_2026';

const SHEETS_SCHEMA = {
  Users: ['user_id', 'name', 'email', 'auth_uid', 'photo_url', 'created_at', 'status'],
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

const GLOBAL_CATEGORIES = [
  ['cat_sys_transfer', 'GLOBAL', 'Perpindahan Dana', 'transfer', 'swap', '#1D4ED8', true]
];

function getExpectedSecret_() {
  const propSecret = PropertiesService.getScriptProperties().getProperty('FINTRACK_SECRET');
  return propSecret || FINTRACK_SECRET;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isAuthorized_(secret) {
  const expected = getExpectedSecret_();
  return Boolean(secret && expected && String(secret) === String(expected));
}

/**
 * Jalankan fungsi ini satu kali dari Editor Apps Script (klik Run)
 * untuk memastikan 14 sheet beserta header sudah lengkap & mengisi kategori GLOBAL.
 */
function verifyAndSeedGlobalCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheetName of Object.keys(SHEETS_SCHEMA)) {
    const expectedHeaders = SHEETS_SCHEMA[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
  }

  // Isi kategori GLOBAL di sheet Categories jika belum ada
  const catSheet = ss.getSheetByName('Categories');
  const existing = catSheet.getDataRange().getValues();
  const existingIds = new Set(existing.slice(1).map((r) => String(r[0])));
  const toInsert = GLOBAL_CATEGORIES.filter((row) => !existingIds.has(row[0]));

  if (toInsert.length > 0) {
    const startRow = catSheet.getLastRow() + 1;
    catSheet.getRange(startRow, 1, toInsert.length, 7).setValues(toInsert);
  }

  Logger.log('Verifikasi 14 sheet selesai. Kategori GLOBAL ditambahkan: ' + toInsert.length);
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (!isAuthorized_(params.secret)) {
      return jsonOut_({ ok: false, error: 'Unauthorized: secret tidak valid.' });
    }

    const action = params.action || 'health';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'health') {
      const sheetNames = Object.keys(SHEETS_SCHEMA);
      const present = sheetNames.filter((n) => Boolean(ss.getSheetByName(n)));
      return jsonOut_({
        ok: true,
        service: 'FINTRACK Google Apps Script',
        spreadsheetName: ss.getName(),
        sheetsPresent: present.length,
        totalExpected: sheetNames.length
      });
    }

    if (action === 'getSnapshot') {
      const userId = String(params.user_id || '').trim();
      if (!userId) {
        return jsonOut_({ ok: false, error: 'user_id wajib disertakan.' });
      }
      return jsonOut_({
        ok: true,
        user_id: userId,
        snapshot: readUserSnapshot_(ss, userId)
      });
    }

    return jsonOut_({ ok: false, error: 'Action GET tidak dikenal.' });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!isAuthorized_(body.secret)) {
      return jsonOut_({ ok: false, error: 'Unauthorized: secret tidak valid.' });
    }

    const action = body.action || 'syncSnapshot';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'getSnapshot') {
      const userId = String(body.user_id || '').trim();
      if (!userId) return jsonOut_({ ok: false, error: 'user_id wajib diisi.' });
      return jsonOut_({
        ok: true,
        user_id: userId,
        snapshot: readUserSnapshot_(ss, userId)
      });
    }

    if (action === 'syncSnapshot') {
      const userId = String(body.user_id || '').trim();
      const snapshot = body.snapshot || {};
      if (!userId) return jsonOut_({ ok: false, error: 'user_id wajib diisi.' });

      // Penguncian penulisan (Bagian 11) untuk mencegah benturan update bersamaan
      lock.waitLock(25000);
      const summary = writeUserSnapshot_(ss, userId, snapshot);
      return jsonOut_({
        ok: true,
        user_id: userId,
        syncedAt: new Date().toISOString(),
        summary
      });
    }

    return jsonOut_({ ok: false, error: 'Action POST tidak dikenal.' });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

function readUserSnapshot_(ss, userId) {
  const tz = ss.getSpreadsheetTimeZone();
  const out = {};

  for (const sheetName of Object.keys(SHEETS_SCHEMA)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() === 0) {
      out[sheetName] = [];
      continue;
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map((h) => String(h).trim());
    const userColIdx = headers.indexOf('user_id');
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      const rawRow = values[i];
      const rowUserId = userColIdx >= 0 ? String(rawRow[userColIdx] || '').trim() : '';
      const isOwned = rowUserId === userId || (sheetName === 'Categories' && rowUserId === 'GLOBAL');
      if (!isOwned) continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const colName = headers[c];
        if (!colName) continue;
        let val = rawRow[c];
        if (val instanceof Date) {
          if (colName === 'created_at' || colName === 'updated_at') {
            val = val.toISOString();
          } else {
            val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
          }
        }
        obj[colName] = val === '' ? null : val;
      }
      rows.push(obj);
    }

    out[sheetName] = rows;
  }

  return out;
}

function sanitizeCellValue_(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean' || typeof val === 'number') return val;
  const str = String(val);
  // Batas Google Sheets = 50.000 karakter per sel (gambar besar sebaiknya ke Firebase Storage)
  if (str.length > 49000) {
    return '[LAMPIRAN_TERLALU_BESAR_GUNAKAN_STORAGE]';
  }
  return str;
}

function writeUserSnapshot_(ss, userId, incomingSnapshot) {
  const summary = {};

  for (const sheetName of Object.keys(SHEETS_SCHEMA)) {
    if (!Array.isArray(incomingSnapshot[sheetName])) continue;

    let sheet = ss.getSheetByName(sheetName);
    const defaultHeaders = SHEETS_SCHEMA[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), defaultHeaders.length);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim());
    const userColIdx = headers.indexOf('user_id');

    // Pertahankan baris milik pengguna lain & kategori GLOBAL
    const preservedRows = [];
    if (lastRow > 1) {
      const existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (const row of existingData) {
        const rowOwner = userColIdx >= 0 ? String(row[userColIdx] || '').trim() : '';
        if (rowOwner !== userId) {
          preservedRows.push(row);
        }
      }
    }

    // Petakan baris masuk milik user_id terverifikasi
    const incomingRows = incomingSnapshot[sheetName]
      .filter((obj) => !(sheetName === 'Categories' && obj && obj.user_id === 'GLOBAL'))
      .map((obj) => {
        return headers.map((colName) => {
          if (colName === 'user_id') return userId;
          return sanitizeCellValue_(obj ? obj[colName] : '');
        });
      });

    const finalRows = preservedRows.concat(incomingRows);

    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    if (finalRows.length > 0) {
      sheet.getRange(2, 1, finalRows.length, headers.length).setValues(finalRows);
    }

    summary[sheetName] = incomingRows.length;
  }

  return summary;
}
