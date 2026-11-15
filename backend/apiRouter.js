/**
 * FINTRACK — Backend REST API Router (Bagian 9 Dokumen Rancangan)
 * Menjembatani frontend PWA dengan autentikasi, antrean penulisan Google Sheets,
 * serta layanan AI Receipt Scanner (Gemini API).
 */

const express = require('express');
const { SHEETS_SCHEMA } = require('./schema');
const { SheetsAdapter } = require('./sheetsAdapter');
const { createLocalToken, requireAuth } = require('./authMiddleware');
const { registerUserWithSync, loginUserWithSync } = require('./authService');
const { analyzeReceipt } = require('./geminiReceiptService');

const router = express.Router();
const sheets = new SheetsAdapter();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'FINTRACK Backend API',
    storageMode: sheets.mode,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    sheetsCount: Object.keys(SHEETS_SCHEMA).length,
    timestamp: new Date().toISOString()
  });
});

router.get('/schema', (req, res) => {
  res.json({
    ok: true,
    sheets: SHEETS_SCHEMA
  });
});

router.post('/auth/register', async (req, res) => {
  try {
    const user = await registerUserWithSync(req.body || {}, sheets);
    const token = createLocalToken({
      user_id: user.user_id,
      email: user.email,
      auth_uid: user.auth_uid
    });
    res.status(201).json({ ok: true, token, user });
  } catch (err) {
    res.status(err.status || 400).json({ ok: false, error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const user = await loginUserWithSync(req.body || {}, sheets);
    const token = createLocalToken({
      user_id: user.user_id,
      email: user.email,
      auth_uid: user.auth_uid
    });
    res.json({ ok: true, token, user });
  } catch (err) {
    res.status(err.status || 401).json({ ok: false, error: err.message });
  }
});

router.post('/auth/session', (req, res) => {
  const { user_id, username, email, auth_uid } = req.body || {};
  const ident = String(username || email || '').trim();
  if (!user_id || !ident) {
    return res.status(400).json({ ok: false, error: 'user_id dan username wajib diisi.' });
  }
  const token = createLocalToken({ user_id, email: ident, auth_uid: auth_uid || user_id });
  res.json({ ok: true, token, user_id });
});

router.get('/sync/snapshot', requireAuth, async (req, res) => {
  try {
    const snapshot = await sheets.getUserSnapshot(req.authUser.user_id);
    res.json({ ok: true, user_id: req.authUser.user_id, snapshot });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Gagal membaca data.' });
  }
});

router.post('/sync/snapshot', requireAuth, async (req, res) => {
  try {
    const result = await sheets.syncUserSnapshot(req.authUser.user_id, req.body?.snapshot || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Gagal sinkronisasi data.' });
  }
});

router.post('/receipts/scan', async (req, res) => {
  try {
    const { imageDataUrl, mimeType, fileName, demoPreset } = req.body || {};
    if (!imageDataUrl && !demoPreset) {
      return res.status(400).json({ ok: false, error: 'Gambar struk atau preset demo diperlukan.' });
    }
    const result = await analyzeReceipt({ imageDataUrl, mimeType, fileName, demoPreset });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Gagal memproses gambar struk.' });
  }
});

module.exports = router;
