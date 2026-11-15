/**
 * FINTRACK — Utilitas Umum, Ikon SVG, Format Mata Uang & Tanggal, Toast, Modal
 */

export function uuid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getInitials(name, fallback = 'FN') {
  const clean = String(name || '').trim();
  if (!clean) return fallback;
  return clean
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || fallback;
}

export function formatRp(num, withSign = false) {
  const n = Number(num || 0);
  const abs = Math.abs(Math.round(n));
  const formatted = `Rp${abs.toLocaleString('id-ID')}`;
  if (n < 0) return `-${formatted}`;
  if (withSign && n > 0) return `+${formatted}`;
  return formatted;
}

export function formatCompactRp(num) {
  const n = Number(num || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}Rp${Math.round(abs / 1_000)}rb`;
  return formatRp(n);
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toISODate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateID(isoDate) {
  if (!isoDate) return '-';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = Number(parts[2]);
  const m = months[Number(parts[1]) - 1] || parts[1];
  return `${d} ${m} ${parts[0]}`;
}

export function monthNameID(monthIndex1Based) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[(monthIndex1Based - 1 + 12) % 12] || '';
}

export function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast-glass ${type}`;
  el.innerHTML = `<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    el.style.transition = '0.2s ease';
    setTimeout(() => el.remove(), 220);
  }, 2900);
}

let activeModalCleanup = null;

export function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (typeof activeModalCleanup === 'function') {
    try { activeModalCleanup(); } catch (_) {}
    activeModalCleanup = null;
  }
  root.innerHTML = `
    <div class="modal-sheet" role="document">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3 class="modal-title">${esc(title)}</h3>
        <button type="button" class="btn-glass-icon" id="modal-close-btn" aria-label="Tutup">
          ${icon('close')}
        </button>
      </div>
      <div id="modal-body">${bodyHtml}</div>
    </div>
  `;
  root.classList.remove('hidden');

  const close = () => closeModal();
  root.querySelector('#modal-close-btn')?.addEventListener('click', close);
  root.onclick = (e) => {
    if (e.target === root) close();
  };

  if (typeof onMount === 'function') {
    const maybeCleanup = onMount(root.querySelector('#modal-body'), close);
    if (typeof maybeCleanup === 'function') {
      activeModalCleanup = maybeCleanup;
    }
  }
  enhanceLiquidSegmented(root);
}

export function closeModal() {
  if (typeof activeModalCleanup === 'function') {
    try { activeModalCleanup(); } catch (_) {}
    activeModalCleanup = null;
  }
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.classList.add('hidden');
  root.innerHTML = '';
}

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a2 2 0 0 1 2-2h2M16 3h2a2 2 0 0 1 2 2v2M20 17v2a2 2 0 0 1-2 2h-2M8 21H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  debt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  night: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 13.5A7.5 7.5 0 0 1 10.5 5c0-.66.08-1.3.24-1.91A8.5 8.5 0 1 0 20.91 13.26c-.61.16-1.25.24-1.91.24z"/><path d="M16 3v3M14.5 4.5h3M20 7v2M19 8h2"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
  utensils: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="4"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
};

export const THEME_MODES = ['light', 'dark', 'night'];
export const THEME_LABELS = {
  light: 'Mode Terang',
  dark: 'Dark Mode',
  night: 'Night Mode'
};
const THEME_META_COLORS = {
  light: '#142B4A',
  dark: '#0F172A',
  night: '#141016'
};
const THEME_ICONS = {
  light: 'sun',
  dark: 'moon',
  night: 'night'
};

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem('fintrack_theme');
    return THEME_MODES.includes(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}

export function applyThemeMode(mode, { persist = true } = {}) {
  const normalized = THEME_MODES.includes(mode) ? mode : 'light';
  document.documentElement.setAttribute('data-theme', normalized);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_META_COLORS[normalized]);
  if (persist) {
    try {
      localStorage.setItem('fintrack_theme', normalized);
    } catch {}
  }

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    const nextMode = THEME_MODES[(THEME_MODES.indexOf(normalized) + 1) % THEME_MODES.length];
    toggleBtn.innerHTML = `<span class="icon-slot">${icon(THEME_ICONS[normalized])}</span>`;
    toggleBtn.title = `${THEME_LABELS[normalized]} (ketuk untuk ${THEME_LABELS[nextMode]})`;
    toggleBtn.setAttribute('aria-label', toggleBtn.title);
  }
  return normalized;
}

export function cycleThemeMode() {
  const current = document.documentElement.getAttribute('data-theme') || getSavedTheme();
  const next = THEME_MODES[(THEME_MODES.indexOf(current) + 1) % THEME_MODES.length];
  return applyThemeMode(next, { persist: true });
}

export function icon(name) {
  const svg = ICONS[name] || ICONS.tag;
  return svg.replace('<svg ', '<svg class="app-icon" width="18" height="18" ');
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const key = el.getAttribute('data-icon');
    el.innerHTML = icon(key);
  });
}

/**
 * Mengembalikan placeholder Skeleton Shimmer yang konsisten dengan tema Neumorphism + Glass.
 * @param {'dashboard'|'sync'|'receipt'|'inline'} variant
 */
export function renderSkeleton(variant = 'dashboard') {
  if (variant === 'inline') {
    return `<span class="skeleton-shimmer skeleton-pill" aria-hidden="true" style="display:inline-block;width:96px;height:18px;vertical-align:middle;"></span>`;
  }
  if (variant === 'receipt') {
    return `
      <div class="neu-card-sm skeleton-card" role="status" aria-label="Menganalisis struk belanja">
        <div class="skeleton-row">
          <div class="skeleton-shimmer skeleton-box" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div class="skeleton-shimmer skeleton-line" style="width:62%;height:12px;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width:42%;height:10px;"></div>
          </div>
          <span class="skeleton-shimmer skeleton-pill" style="width:64px;height:20px;"></span>
        </div>
        <div class="skeleton-shimmer skeleton-line" style="width:88%;height:10px;margin-top:10px;"></div>
        <div class="skeleton-shimmer skeleton-line" style="width:56%;height:10px;margin-top:6px;"></div>
      </div>`;
  }
  if (variant === 'sync') {
    return `
      <div class="neu-card-sm skeleton-card" role="status" aria-label="Menyinkronkan cloud">
        <div class="skeleton-row">
          <div class="skeleton-shimmer skeleton-box" style="width:36px;height:36px;border-radius:11px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:7px;">
            <div class="skeleton-shimmer skeleton-line" style="width:68%;height:12px;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width:46%;height:10px;"></div>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="skeleton-stack" role="status" aria-label="Memuat data keuangan">
      <div class="neu-hero-card skeleton-hero">
        <div class="skeleton-shimmer skeleton-on-dark skeleton-pill" style="width:128px;height:22px;"></div>
        <div class="skeleton-shimmer skeleton-on-dark skeleton-line" style="width:64%;height:30px;margin-top:14px;border-radius:10px;"></div>
        <div class="skeleton-shimmer skeleton-on-dark skeleton-line" style="width:44%;height:13px;margin-top:10px;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
          <div class="skeleton-shimmer skeleton-on-dark skeleton-box" style="height:52px;border-radius:14px;"></div>
          <div class="skeleton-shimmer skeleton-on-dark skeleton-box" style="height:52px;border-radius:14px;"></div>
        </div>
      </div>
      <div class="neu-card skeleton-card">
        <div class="skeleton-shimmer skeleton-line" style="width:38%;height:12px;margin-bottom:12px;"></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div class="skeleton-shimmer skeleton-box" style="height:68px;border-radius:16px;"></div>
          <div class="skeleton-shimmer skeleton-box" style="height:68px;border-radius:16px;"></div>
          <div class="skeleton-shimmer skeleton-box" style="height:68px;border-radius:16px;"></div>
          <div class="skeleton-shimmer skeleton-box" style="height:68px;border-radius:16px;"></div>
        </div>
      </div>
      <div class="neu-card skeleton-card">
        <div class="skeleton-shimmer skeleton-line" style="width:45%;height:12px;margin-bottom:14px;"></div>
        ${[1, 2, 3].map(() => `
          <div class="skeleton-row" style="margin-bottom:12px;">
            <div class="skeleton-shimmer skeleton-box" style="width:42px;height:42px;border-radius:14px;flex-shrink:0;"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:7px;">
              <div class="skeleton-shimmer skeleton-line" style="width:60%;height:12px;"></div>
              <div class="skeleton-shimmer skeleton-line" style="width:36%;height:10px;"></div>
            </div>
            <div class="skeleton-shimmer skeleton-line" style="width:70px;height:14px;"></div>
          </div>`).join('')}
      </div>
    </div>`;
}

/**
 * Efek riak sentuhan radial tepat di titik jari/kursor menekan tombol.
 */
export function spawnTapRipple(target, evt) {
  if (!target || target.disabled) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const size = Math.max(rect.width, rect.height) * 1.6;
  const hasCoords = evt && typeof evt.clientX === 'number' && evt.clientY > 0;
  const x = hasCoords ? evt.clientX - rect.left : rect.width / 2;
  const y = hasCoords ? evt.clientY - rect.top : rect.height / 2;

  const ripple = document.createElement('span');
  ripple.className = 'tap-ripple';
  ripple.style.setProperty('--ripple-x', `${x}px`);
  ripple.style.setProperty('--ripple-y', `${y}px`);
  ripple.style.setProperty('--ripple-size', `${size}px`);
  target.appendChild(ripple);
  const cleanup = () => ripple.remove();
  ripple.addEventListener('animationend', cleanup, { once: true });
  setTimeout(cleanup, 650);
}

/**
 * Memilih elemen yang pusat horizontalnya paling dekat ke koordinat pointer X.
 */
export function nearestByCenterX(elements, clientX) {
  let bestEl = null;
  let bestDist = Infinity;
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const dist = Math.abs(clientX - center);
    if (dist < bestDist) {
      bestDist = dist;
      bestEl = el;
    }
  }
  return bestEl;
}

const segLastIndex = new Map();

/**
 * Mengaktifkan pil Liquid Glass yang bergeser mulus dan mengikuti gerakan jari
 * pada komponen `.neu-segmented` di mana pun berada.
 */
export function enhanceLiquidSegmented(root = document) {
  root.querySelectorAll('.neu-segmented').forEach((seg, idx) => {
    const btns = Array.from(seg.querySelectorAll('.neu-seg-btn'));
    if (!btns.length) return;
    seg.classList.add('has-liquid-pill');

    const segKey = seg.dataset.segKey
      || btns.map((b) => b.dataset.period || b.dataset.type || b.dataset.warnPct || b.textContent.trim()).join('|')
      || `seg_${idx}`;

    let pill = seg.querySelector(':scope > .seg-liquid-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'seg-liquid-pill';
      pill.setAttribute('aria-hidden', 'true');
      seg.prepend(pill);
    }

    const placePillOn = (btn, animate = true) => {
      if (!btn) return;
      const segRect = seg.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (!segRect.width || !btnRect.width) return;
      const offsetX = btnRect.left - segRect.left - seg.clientLeft;
      if (!animate) pill.classList.add('no-anim');
      pill.style.width = `${btnRect.width}px`;
      pill.style.height = `${btnRect.height}px`;
      pill.style.transform = `translate3d(${offsetX}px, 0, 0)`;
      if (!animate) {
        void pill.offsetWidth;
        pill.classList.remove('no-anim');
      }
    };

    const activeIdx = Math.max(0, btns.findIndex((b) => b.classList.contains('active')));
    const prevIdx = segLastIndex.has(segKey) ? segLastIndex.get(segKey) : activeIdx;
    segLastIndex.set(segKey, activeIdx);

    requestAnimationFrame(() => {
      if (prevIdx !== activeIdx && btns[prevIdx]) {
        placePillOn(btns[prevIdx], false);
        requestAnimationFrame(() => placePillOn(btns[activeIdx], true));
      } else {
        placePillOn(btns[activeIdx], false);
      }
    });

    if (seg.dataset.liquidBound) return;
    seg.dataset.liquidBound = '1';

    let tracking = false;
    let moved = false;
    let startX = 0;

    seg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      tracking = true;
      moved = false;
      startX = e.clientX;
    });

    seg.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        seg.setPointerCapture?.(e.pointerId);
        pill.classList.add('is-dragging');
      }
      if (!moved) return;
      const segRect = seg.getBoundingClientRect();
      const pillW = pill.offsetWidth || (segRect.width / btns.length);
      const minX = 5;
      const maxX = Math.max(minX, segRect.width - pillW - 5);
      const rawX = e.clientX - segRect.left - pillW / 2;
      const clampedX = Math.max(minX, Math.min(maxX, rawX));
      const lightPct = Math.max(15, Math.min(85, 50 + dx * 0.4));
      pill.style.setProperty('--light-x', `${lightPct}%`);
      pill.style.transform = `translate3d(${clampedX}px, 0, 0) scale(1.03, 0.95)`;
    });

    const finishDrag = (e) => {
      if (!tracking) return;
      tracking = false;
      if (!moved) {
        const clickedBtn = e.target?.closest?.('.neu-seg-btn');
        if (clickedBtn && seg.contains(clickedBtn)) {
          placePillOn(clickedBtn, true);
        }
        return;
      }
      pill.classList.remove('is-dragging');
      seg.releasePointerCapture?.(e.pointerId);
      const nearest = nearestByCenterX(btns, e.clientX);
      if (nearest) {
        placePillOn(nearest, true);
        if (!nearest.classList.contains('active')) {
          nearest.click();
        }
      }
    };

    seg.addEventListener('pointerup', finishDrag);
    seg.addEventListener('pointercancel', () => {
      tracking = false;
      moved = false;
      pill.classList.remove('is-dragging');
      const cur = btns.find((b) => b.classList.contains('active')) || btns[0];
      placePillOn(cur, true);
    });
  });
}
