/**
 * FINTRACK — Auth Verification Middleware (Bagian 9 & 11 Dokumen Rancangan)
 * Backend memverifikasi identitas pengguna dan mengekstrak `user_id` terverifikasi
 * sebelum membaca atau mengubah data milik pengguna tersebut.
 */

const crypto = require('crypto');

const SESSION_SECRET = process.env.FINTRACK_SESSION_SECRET || 'fintrack-dev-local-secret-key';

function createLocalToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyLocalToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Middleware: Memastikan request memiliki token identitas terverifikasi.
 * Di lingkungan produksi Firebase Cloud Functions, ganti verifikasi dengan
 * `admin.auth().verifyIdToken(token)` lalu cocokkan `auth_uid` ke tabel `Users`.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Token autentikasi diperlukan.'
    });
  }

  const decoded = verifyLocalToken(token);
  if (!decoded || !decoded.user_id) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Token tidak valid atau kedaluwarsa.'
    });
  }

  req.authUser = {
    user_id: decoded.user_id,
    auth_uid: decoded.auth_uid || decoded.user_id,
    email: decoded.email || ''
  };
  next();
}

module.exports = {
  createLocalToken,
  verifyLocalToken,
  requireAuth
};
