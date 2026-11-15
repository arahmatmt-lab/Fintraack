/**
 * FINTRACK — Server Entry Point (Node.js + Express)
 * Menyajikan frontend PWA (Firebase Hosting compatible) dan REST API Backend.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// Muat variabel dari .env bila ada (tanpa mengubah variabel environment sistem & skip saat mode test)
const envPath = path.join(__dirname, '.env');
if (process.env.NODE_ENV !== 'test' && fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const apiRouter = require('./backend/apiRouter');

const app = express();
const PORT = Number(process.env.PORT) || 3080;

app.use(express.json({ limit: '12mb' }));

// Security headers (Bagian 11)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api', apiRouter);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'Endpoint API tidak ditemukan.' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

function getLanUrls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        urls.push({ name, url: `http://${iface.address}:${port}` });
      }
    }
  }
  return urls;
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FINTRACK PWA & API berjalan di http://localhost:${PORT}`);
    for (const entry of getLanUrls(PORT)) {
      console.log(`Akses Jaringan Lokal (${entry.name}): ${entry.url}`);
    }
  });
}

module.exports = app;
