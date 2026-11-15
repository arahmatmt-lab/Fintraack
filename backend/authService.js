/**
 * FINTRACK — Backend User Authentication Service (Bagian 9 & 11)
 * Mengelola registrasi dan verifikasi kredensial dengan hash `scrypt` + salt acak.
 * Kata sandi/PIN disimpan terenkripsi hash di sisi server (`auth_users.json`),
 * TIDAK PERNAH disimpan ke Google Sheets `Users` (sesuai Bagian 11).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { resolveDataFile, resolveWritableDataDir } = require('./storageDir');

const REMOTE_AUTH_USER_ID = '__FINTRACK_SERVER_AUTH__';

function getStorePath() {
  const filename = process.env.NODE_ENV === 'test' ? 'auth_users.test.json' : 'auth_users.json';
  return resolveDataFile(filename);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, keyHex] = String(storedHash || '').split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(String(password), salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function ensureAuthStore() {
  const dataDir = resolveWritableDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    const initial = [];
    try {
      fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), 'utf8');
    } catch {
      // Abaikan jika disk read-only; cloud sync Apps Script akan menangani persistensi
    }
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAuthStore(users) {
  const dataDir = path.dirname(getStorePath());
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(getStorePath(), JSON.stringify(users, null, 2), 'utf8');
}

function sanitizePublicUser(u) {
  const ident = u.username || u.email || '';
  return {
    user_id: u.user_id,
    name: u.name,
    username: ident,
    email: ident,
    auth_uid: u.auth_uid,
    photo_url: u.photo_url || '',
    created_at: u.created_at,
    status: u.status || 'active'
  };
}

function normalizeIdentifier(raw) {
  return String(raw || '').trim().toLowerCase();
}

function registerUser({ name, username, email, password }) {
  const cleanName = String(name || '').trim();
  const cleanIdent = normalizeIdentifier(username || email);
  const rawPass = String(password || '');

  if (!cleanName || cleanName.length < 2) {
    const err = new Error('Nama lengkap minimal 2 karakter.');
    err.status = 400;
    throw err;
  }
  if (!cleanIdent || !/^[a-z0-9._@-]{3,40}$/.test(cleanIdent)) {
    const err = new Error('Username 3–40 karakter (huruf, angka, titik, _ atau - tanpa spasi).');
    err.status = 400;
    throw err;
  }
  if (rawPass.length < 6) {
    const err = new Error('Kata sandi / PIN minimal 6 karakter.');
    err.status = 400;
    throw err;
  }

  const users = ensureAuthStore();
  if (users.some((u) => normalizeIdentifier(u.username || u.email) === cleanIdent)) {
    const err = new Error('Username sudah terdaftar. Silakan masuk.');
    err.status = 409;
    throw err;
  }

  const user = {
    user_id: `usr_${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName,
    username: cleanIdent,
    email: cleanIdent,
    auth_uid: `fb_${crypto.randomUUID().slice(0, 12)}`,
    photo_url: '',
    created_at: new Date().toISOString(),
    status: 'active',
    password_hash: hashPassword(rawPass)
  };

  users.push(user);
  saveAuthStore(users);
  return sanitizePublicUser(user);
}

function loginUser({ username, email, password }) {
  const cleanIdent = normalizeIdentifier(username || email);
  const rawPass = String(password || '');

  if (!cleanIdent || !rawPass) {
    const err = new Error('Username dan kata sandi wajib diisi.');
    err.status = 400;
    throw err;
  }

  const users = ensureAuthStore();
  const found = users.find((u) => {
    const uName = normalizeIdentifier(u.username);
    const uMail = normalizeIdentifier(u.email);
    return (uName && uName === cleanIdent) || (uMail && uMail === cleanIdent);
  });
  if (!found || !verifyPassword(rawPass, found.password_hash)) {
    const err = new Error('Username atau kata sandi salah.');
    err.status = 401;
    throw err;
  }

  return sanitizePublicUser(found);
}

function hasRemoteAuthBackend(sheetsAdapter) {
  return Boolean(
    process.env.NODE_ENV !== 'test' &&
    sheetsAdapter &&
    sheetsAdapter.appsScriptUrl &&
    sheetsAdapter.appsScriptSecret
  );
}

function mergeAuthUsers(localUsers, remoteUsers) {
  const byId = new Map();
  for (const u of [...remoteUsers, ...localUsers]) {
    if (u && u.user_id && u.password_hash) {
      byId.set(u.user_id, u);
    }
  }
  return Array.from(byId.values());
}

async function pullRemoteAuthUsers(sheetsAdapter) {
  if (!hasRemoteAuthBackend(sheetsAdapter)) return null;
  const snapshot = await sheetsAdapter.getUserSnapshot(REMOTE_AUTH_USER_ID);
  const rows = Array.isArray(snapshot?.Settings) ? snapshot.Settings : [];
  const remoteUsers = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(String(row?.setting_value || ''));
      if (parsed && parsed.user_id && parsed.password_hash) {
        remoteUsers.push(parsed);
      }
    } catch {
      // Lewati baris non-JSON
    }
  }
  return remoteUsers;
}

async function pushRemoteAuthUsers(sheetsAdapter, users) {
  if (!hasRemoteAuthBackend(sheetsAdapter)) return null;
  const settingsRows = (users || [])
    .filter((u) => u && u.user_id && u.password_hash)
    .map((u) => ({
      setting_id: `auth_${u.user_id}`,
      user_id: REMOTE_AUTH_USER_ID,
      setting_key: normalizeIdentifier(u.username || u.email),
      setting_value: JSON.stringify(u)
    }));
  return sheetsAdapter.syncUserSnapshot(REMOTE_AUTH_USER_ID, { Settings: settingsRows });
}

async function registerUserWithSync(payload, sheetsAdapter = null) {
  if (hasRemoteAuthBackend(sheetsAdapter)) {
    const remoteUsers = await pullRemoteAuthUsers(sheetsAdapter);
    if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
      const merged = mergeAuthUsers(ensureAuthStore(), remoteUsers);
      saveAuthStore(merged);
    }
  }

  const created = registerUser(payload);

  if (hasRemoteAuthBackend(sheetsAdapter)) {
    const latestUsers = ensureAuthStore();
    await pushRemoteAuthUsers(sheetsAdapter, latestUsers);
  }
  return created;
}

async function loginUserWithSync(payload, sheetsAdapter = null) {
  try {
    return loginUser(payload);
  } catch (err) {
    if (!hasRemoteAuthBackend(sheetsAdapter)) throw err;
    // Hanya tarik ulang jika belum ada / gagal kecocokan lokal (mis. cold-start serverless `/tmp` kosong)
    const cleanIdent = normalizeIdentifier(payload?.username || payload?.email);
    const rawPass = String(payload?.password || '');
    if (!cleanIdent || !rawPass) throw err;

    const remoteUsers = await pullRemoteAuthUsers(sheetsAdapter);
    if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
      const merged = mergeAuthUsers(ensureAuthStore(), remoteUsers);
      saveAuthStore(merged);
    }
    return loginUser(payload);
  }
}

module.exports = {
  registerUser,
  loginUser,
  registerUserWithSync,
  loginUserWithSync,
  pushRemoteAuthUsers,
  ensureAuthStore,
  getStorePath
};
