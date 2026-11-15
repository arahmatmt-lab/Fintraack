/**
 * FINTRACK — Shared Writable Data Directory Resolver
 * Menentukan direktori data yang dapat ditulis di server tradisional (lokal/VPS/Railway Volume)
 * maupun serverless read-only filesystem seperti Vercel (`/tmp/fintrack-data`).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

let cachedDataDir = null;

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NOW_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function tryPrepareDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveWritableDataDir() {
  if (process.env.FINTRACK_DATA_DIR) {
    const customDir = path.resolve(process.env.FINTRACK_DATA_DIR);
    tryPrepareDir(customDir);
    return customDir;
  }

  if (cachedDataDir && fs.existsSync(cachedDataDir)) {
    return cachedDataDir;
  }

  const localDir = path.join(__dirname, 'data');
  const tmpDir = path.join(os.tmpdir(), 'fintrack-data');

  if (!isServerlessRuntime() && tryPrepareDir(localDir)) {
    cachedDataDir = localDir;
    return cachedDataDir;
  }

  tryPrepareDir(tmpDir);
  cachedDataDir = tmpDir;
  return cachedDataDir;
}

function resolveDataFile(filename) {
  return path.join(resolveWritableDataDir(), filename);
}

function resetCachedDataDir() {
  cachedDataDir = null;
}

module.exports = {
  isServerlessRuntime,
  resolveWritableDataDir,
  resolveDataFile,
  resetCachedDataDir
};
