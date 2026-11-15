/**
 * FINTRACK — Backend User Authentication Service (Bagian 9 & 11)
 * Mengelola registrasi dan verifikasi kredensial dengan hash `scrypt` + salt acak.
 * Kata sandi/PIN disimpan terenkripsi hash di sisi server (`auth_users.json`),
 * TIDAK PERNAH disimpan ke Google Sheets `Users` (sesuai Bagian 11).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function getStorePath() {
  const filename = process.env.NODE_ENV === 'test' ? 'auth_users.test.json' : 'auth_users.json';
  return path.join(DATA_DIR, filename);
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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    const initial = [];
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), 'utf8');
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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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

module.exports = {
  registerUser,
  loginUser,
  ensureAuthStore,
  getStorePath
};
