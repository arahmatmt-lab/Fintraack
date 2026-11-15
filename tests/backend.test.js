process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { SHEETS_SCHEMA } = require('../backend/schema');
const { createLocalToken, verifyLocalToken } = require('../backend/authMiddleware');
const { validateCalculation, analyzeReceipt } = require('../backend/geminiReceiptService');
const app = require('../server');

test('Skema Google Sheets memiliki tepat 14 tabel dengan kolom user_id pada tabel operasional', () => {
  const expectedSheets = [
    'Users', 'Wallets', 'Categories', 'Transactions', 'Budgets',
    'Savings_Goals', 'Savings_Activities', 'Debts', 'Debt_Payments',
    'Recurring', 'Notifications', 'Settings', 'Receipts', 'Receipt_Items'
  ];
  assert.deepEqual(Object.keys(SHEETS_SCHEMA), expectedSheets);
  for (const sheet of expectedSheets) {
    assert.ok(SHEETS_SCHEMA[sheet].includes('user_id'), `${sheet} harus memiliki kolom user_id`);
  }
});

test('Token autentikasi lokal terverifikasi dan menolak token yang diubah', () => {
  const token = createLocalToken({ user_id: 'usr_1', email: 'test@fintrack.id' });
  const decoded = verifyLocalToken(token);
  assert.equal(decoded.user_id, 'usr_1');
  assert.equal(verifyLocalToken(`${token}tampered`), null);
});

test('Validasi perhitungan struk AI mendeteksi konsistensi dan selisih', () => {
  const valid = validateCalculation({
    items: [{ total_price: 38000 }],
    subtotal: 38000,
    tax: 0,
    discount: 2000,
    total_amount: 36000
  });
  assert.equal(valid.is_consistent, true);

  const mismatch = validateCalculation({
    items: [{ total_price: 50000 }],
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total_amount: 36000
  });
  assert.equal(mismatch.is_consistent, false);
});

test('Layanan AI Receipt Scanner preset mengembalikan draft untuk konfirmasi pengguna', async () => {
  const res = await analyzeReceipt({ demoPreset: 'minimarket' });
  assert.equal(res.ai_status, 'draft_for_confirmation');
  assert.equal(res.data.merchant_name, 'Minimarket ABC');
  assert.equal(res.data.total_amount, 36000);
  assert.equal(res.validation.is_consistent, true);
});

test('Endpoint API Server merespons sesuai arsitektur keamanan', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.sheetsCount, 14);

    // Endpoint sync harus menolak request tanpa token
    const unauthRes = await fetch(`${baseUrl}/api/sync/snapshot`);
    assert.equal(unauthRes.status, 401);

    // Dapatkan token lalu sync snapshot
    const authRes = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'usr_test_iso', email: 'iso@fintrack.id' })
    });
    const authJson = await authRes.json();
    assert.equal(authJson.ok, true);

    const syncRes = await fetch(`${baseUrl}/api/sync/snapshot`, {
      headers: { Authorization: `Bearer ${authJson.token}` }
    });
    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.equal(syncJson.user_id, 'usr_test_iso');

    // Uji Register & Login dengan username & password hashing
    const fs = require('node:fs');
    const { getStorePath } = require('../backend/authService');
    try { fs.unlinkSync(getStorePath()); } catch {}

    const userRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rizky Pratama', username: 'rizky_01', password: 'rahasia123' })
    });
    assert.equal(userRegRes.status, 201);
    const userRegJson = await userRegRes.json();
    assert.equal(userRegJson.ok, true);
    assert.equal(userRegJson.user.username, 'rizky_01');
    assert.equal(userRegJson.user.password_hash, undefined);

    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'rizky_01', password: 'rahasia123' })
    });
    assert.equal(userLoginRes.status, 200);
    const userLoginJson = await userLoginRes.json();
    assert.equal(userLoginJson.ok, true);
    assert.ok(userLoginJson.token);

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Budi Uji', email: 'budi@fintrack.id', password: 'rahasia123' })
    });
    assert.equal(regRes.status, 201);
    const regJson = await regRes.json();
    assert.equal(regJson.ok, true);
    assert.equal(regJson.user.email, 'budi@fintrack.id');
    assert.equal(regJson.user.password_hash, undefined);

    // Username/Email duplikat harus ditolak (409)
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Budi 2', email: 'budi@fintrack.id', password: 'rahasia123' })
    });
    assert.equal(dupRes.status, 409);

    // Password salah harus ditolak (401)
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'budi@fintrack.id', password: 'salah' })
    });
    assert.equal(badLoginRes.status, 401);

    // Login valid berhasil dan mengembalikan token
    const goodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'budi@fintrack.id', password: 'rahasia123' })
    });
    assert.equal(goodLoginRes.status, 200);
    const goodLoginJson = await goodLoginRes.json();
    assert.equal(goodLoginJson.ok, true);
    assert.ok(goodLoginJson.token);
    try { fs.unlinkSync(getStorePath()); } catch {}
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
