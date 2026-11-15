/**
 * FINTRACK — Main Application Controller (PWA + Routing + Auth + Notifications)
 */

import { db } from './db.js';
import { THEME_LABELS, applyThemeMode, cycleThemeMode, enhanceLiquidSegmented, esc, getInitials, getSavedTheme, hydrateIcons, icon, nearestByCenterX, openModal, renderSkeleton, showToast, spawnTapRipple } from './utils.js';
import { renderBeranda } from './views/beranda.js';
import { openTransactionModal, renderTransaksi } from './views/transaksi.js';
import { renderKalender } from './views/kalender.js';
import { renderAnggaran } from './views/anggaran.js';
import { renderLainnya } from './views/lainnya.js';
import { openReceiptScannerModal } from './views/receiptScanner.js';

const state = {
  tab: 'beranda',
  lainnyaSubpage: null
};

const authView = document.getElementById('auth-view');
const appShell = document.getElementById('app-shell');
const appMain = document.getElementById('app-main');
const fabBtn = document.getElementById('btn-fab-add');

const ctx = {
  navigate(tab) {
    state.tab = tab;
    state.lainnyaSubpage = null;
    renderApp();
  },
  openSubpage(sub) {
    state.tab = 'lainnya';
    state.lainnyaSubpage = sub;
    renderApp();
  },
  openScanner() {
    openReceiptScannerModal(() => renderApp());
  },
  refresh() {
    renderApp();
  },
  logout() {
    db.logout();
    renderRoot();
  }
};

function renderAuthView() {
  authView.classList.remove('hidden');
  appShell.classList.add('hidden');
  let mode = 'login';
  let showPass = false;
  let errorMsg = '';

  const draw = () => {
    const activeTheme = getSavedTheme();
    authView.innerHTML = `
      <div style="display:flex;justify-content:flex-end;">
        <div class="neu-segmented" role="group" aria-label="Pilih Tema" style="max-width:210px;">
          <button type="button" class="neu-seg-btn ${activeTheme === 'light' ? 'active' : ''}" data-auth-theme="light" style="padding:5px 9px;font-size:11px;">Terang</button>
          <button type="button" class="neu-seg-btn ${activeTheme === 'dark' ? 'active' : ''}" data-auth-theme="dark" style="padding:5px 9px;font-size:11px;">Dark</button>
          <button type="button" class="neu-seg-btn ${activeTheme === 'night' ? 'active' : ''}" data-auth-theme="night" style="padding:5px 9px;font-size:11px;">Night</button>
        </div>
      </div>
      <div class="auth-hero">
        <div class="auth-logo-wrap">
          <img src="/icons/icon.svg" alt="FINTRACK" />
        </div>
        <h1 style="margin:0;font-size:23px;font-weight:800;color:var(--navy);letter-spacing:0.02em;">FINTRACK</h1>
        <p style="margin:4px 0 0;font-size:12.5px;color:var(--slate-soft);">
          Personal Finance Management • Silakan masuk terlebih dahulu
        </p>
      </div>

      <div class="neu-card">
        <div class="neu-segmented" style="margin-bottom:14px;">
          <button type="button" class="neu-seg-btn ${mode === 'login' ? 'active' : ''}" data-amode="login">Masuk</button>
          <button type="button" class="neu-seg-btn ${mode === 'register' ? 'active' : ''}" data-amode="register">Daftar Akun</button>
        </div>

        ${errorMsg ? `
          <div id="auth-error-box" class="neu-inset-box" style="margin-bottom:12px;border-left:4px solid var(--danger);font-size:12px;font-weight:700;color:var(--danger);">
            ${esc(errorMsg)}
          </div>
        ` : ''}

        <form id="auth-form">
          ${mode === 'register' ? `
            <div class="form-group">
              <label class="form-label">Nama Lengkap *</label>
              <input type="text" id="auth-name" class="neu-input" placeholder="Masukkan nama lengkap" autocomplete="name" required />
            </div>
          ` : ''}
          <div class="form-group">
            <label class="form-label">Username *</label>
            <input type="text" id="auth-username" class="neu-input" placeholder="Contoh: budi_01" autocomplete="username" minlength="3" required />
          </div>
          <div class="form-group">
            <label class="form-label">Kata Sandi / PIN *</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="${showPass ? 'text' : 'password'}" id="auth-pin" class="neu-input" placeholder="${mode === 'register' ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" minlength="6" required style="flex:1;" />
              <button type="button" id="btn-toggle-pass" class="btn-glass btn-sm" style="white-space:nowrap;">${showPass ? 'Tutup' : 'Lihat'}</button>
            </div>
          </div>
          ${mode === 'register' ? `
            <div class="form-group">
              <label class="form-label">Konfirmasi Kata Sandi / PIN *</label>
              <input type="${showPass ? 'text' : 'password'}" id="auth-pin-confirm" class="neu-input" placeholder="Ulangi kata sandi" autocomplete="new-password" minlength="6" required />
            </div>
          ` : ''}
          <button type="submit" id="btn-auth-submit" class="${mode === 'register' ? 'btn-glass-emerald' : 'btn-glass-primary'} btn-block" style="margin-top:4px;">
            ${mode === 'login' ? 'Masuk ke FINTRACK' : 'Daftar & Masuk'}
          </button>
        </form>
      </div>

    `;

    authView.querySelectorAll('[data-auth-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = applyThemeMode(btn.getAttribute('data-auth-theme'));
        showToast(`${THEME_LABELS[chosen]} diaktifkan.`, 'info');
        draw();
      });
    });

    authView.querySelectorAll('[data-amode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.getAttribute('data-amode');
        errorMsg = '';
        draw();
      });
    });

    queueMicrotask(() => enhanceLiquidSegmented(authView));

    authView.querySelector('#btn-toggle-pass')?.addEventListener('click', () => {
      const userVal = authView.querySelector('#auth-username')?.value || '';
      const nameVal = authView.querySelector('#auth-name')?.value || '';
      const pinVal = authView.querySelector('#auth-pin')?.value || '';
      const confVal = authView.querySelector('#auth-pin-confirm')?.value || '';
      showPass = !showPass;
      draw();
      if (authView.querySelector('#auth-username')) authView.querySelector('#auth-username').value = userVal;
      if (authView.querySelector('#auth-name')) authView.querySelector('#auth-name').value = nameVal;
      if (authView.querySelector('#auth-pin')) authView.querySelector('#auth-pin').value = pinVal;
      if (authView.querySelector('#auth-pin-confirm')) authView.querySelector('#auth-pin-confirm').value = confVal;
    });

    authView.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = authView.querySelector('#btn-auth-submit');
      const username = authView.querySelector('#auth-username').value.trim();
      const password = authView.querySelector('#auth-pin').value;

      if (mode === 'register') {
        const name = authView.querySelector('#auth-name').value.trim();
        const confirmPass = authView.querySelector('#auth-pin-confirm').value;
        if (password !== confirmPass) {
          errorMsg = 'Konfirmasi kata sandi tidak cocok.';
          draw();
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mendaftarkan akun...';
        try {
          await db.registerWithBackend({ name, username, password });
          showToast('Akun baru berhasil dibuat & tersinkron!', 'success');
          state.tab = 'beranda';
          state.lainnyaSubpage = null;
          lastSyncedUserId = null;
          renderRoot();
        } catch (err) {
          errorMsg = err.message || 'Gagal mendaftar.';
          showToast(errorMsg, 'error');
          draw();
        }
      } else {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memeriksa akun...';
        try {
          await db.loginWithBackend({ username, password });
          showToast('Selamat datang kembali!', 'success');
          state.tab = 'beranda';
          state.lainnyaSubpage = null;
          lastSyncedUserId = null;
          renderRoot();
        } catch (err) {
          errorMsg = err.message || 'Gagal masuk.';
          showToast(errorMsg, 'error');
          draw();
        }
      }
    });

  };

  draw();
}

function updateHeaderAndNav() {
  const user = db.getCurrentUser();
  const initials = getInitials(user?.name);
  const initEl = document.getElementById('user-initials');
  if (initEl) initEl.textContent = initials;

  const subLabels = {
    beranda: 'Ringkasan Keuangan',
    transaksi: 'Pencatatan & Riwayat',
    kalender: 'Kalender & Pengingat',
    anggaran: 'Kontrol Anggaran',
    lainnya: 'Modul & Pengaturan'
  };
  const subEl = document.getElementById('header-subtitle');
  if (subEl) subEl.textContent = subLabels[state.tab] || 'Keuangan Pribadi';

  const notifs = db.getNotifications();
  const unreadCount = notifs.filter((n) => !n.is_read).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = String(unreadCount);
    badge.classList.toggle('hidden', unreadCount === 0);
  }

  document.querySelectorAll('#bottom-navbar .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === state.tab);
  });

  if (fabBtn) {
    const showFab = state.tab === 'beranda' || state.tab === 'transaksi';
    fabBtn.classList.toggle('hidden', !showFab);
  }
}

function openNotificationsModal() {
  const notifs = db.getNotifications();
  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span class="badge badge-navy">${notifs.filter((n) => !n.is_read).length} Belum Dibaca</span>
      <button type="button" id="btn-mark-read" class="btn-glass btn-sm">Tandai Dibaca</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${notifs.length === 0 ? `<div class="empty-state">Belum ada notifikasi.</div>` : notifs.slice(0, 15).map((n) => `
        <div class="neu-card-sm" style="border-left:4px solid ${n.notification_type === 'budget_over' ? 'var(--danger)' : n.notification_type === 'budget_warning' ? 'var(--warning)' : 'var(--emerald)'};opacity:${n.is_read ? '0.78' : '1'};">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <strong style="font-size:12.5px;color:var(--navy);">${esc(n.title)}</strong>
            ${!n.is_read ? '<span class="badge badge-emerald">Baru</span>' : ''}
          </div>
          <div style="font-size:11.5px;color:var(--slate-soft);margin-top:4px;">${esc(n.message)}</div>
        </div>
      `).join('')}
    </div>
  `;

  openModal('Pusat Notifikasi', html, (rootEl, close) => {
    rootEl.querySelector('#btn-mark-read')?.addEventListener('click', () => {
      db.markAllNotificationsRead();
      updateHeaderAndNav();
      close();
      showToast('Semua notifikasi ditandai sudah dibaca.', 'info');
    });
  });
}

const TAB_ORDER = ['beranda', 'transaksi', 'kalender', 'anggaran', 'lainnya'];
const RIPPLE_SELECTOR = [
  '.btn-glass',
  '.btn-glass-primary',
  '.btn-glass-emerald',
  '.btn-glass-navy',
  '.btn-glass-danger',
  '.btn-glass-subtle',
  '.btn-glass-avatar',
  '.fab-glass',
  '.quick-action-btn',
  '.menu-tile',
  '.sync-tile-btn',
  '.glass-pill',
  '.account-switch-item'
].join(', ');

let lastRenderedTab = null;
let lastRenderedSubpage = null;
let lastSyncedUserId = null;
let microInteractionsBound = false;

function animateMainView(direction) {
  if (!direction) return;
  appMain.classList.remove('view-slide-left', 'view-slide-right', 'view-fade-up');
  void appMain.offsetWidth;
  const cls = direction === 'left'
    ? 'view-slide-left'
    : direction === 'right'
    ? 'view-slide-right'
    : 'view-fade-up';
  appMain.classList.add(cls);
  appMain.addEventListener('animationend', () => {
    appMain.classList.remove('view-slide-left', 'view-slide-right', 'view-fade-up');
  }, { once: true });
}

function positionNavIndicator(targetBtn = null, { animate = true } = {}) {
  const navbar = document.getElementById('bottom-navbar');
  const indicator = document.getElementById('nav-liquid-indicator');
  if (!navbar || !indicator) return;
  const activeBtn = targetBtn || navbar.querySelector('.nav-item.active') || navbar.querySelector('.nav-item');
  if (!activeBtn) return;

  const navRect = navbar.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  if (!navRect.width || !btnRect.width) return;

  const offsetX = btnRect.left - navRect.left - navbar.clientLeft;
  if (!animate) indicator.classList.add('no-anim');
  indicator.style.width = `${btnRect.width}px`;
  indicator.style.transform = `translate3d(${offsetX}px, 0, 0)`;
  indicator.style.setProperty('--light-x', '50%');
  if (!animate) {
    void indicator.offsetWidth;
    indicator.classList.remove('no-anim');
  }
}

function initMicroInteractions() {
  if (microInteractionsBound) return;
  microInteractionsBound = true;

  const header = document.getElementById('top-header');
  const shell = document.querySelector('.mobile-shell');
  const syncHeaderScroll = () => {
    const y = Math.max(window.scrollY || 0, shell?.scrollTop || 0);
    header?.classList.toggle('is-scrolled', y > 8);
  };
  window.addEventListener('scroll', syncHeaderScroll, { passive: true });
  shell?.addEventListener('scroll', syncHeaderScroll, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    const target = e.target?.closest?.(RIPPLE_SELECTOR);
    if (target) spawnTapRipple(target, e);
  }, { passive: true });

  const navbar = document.getElementById('bottom-navbar');
  const indicator = document.getElementById('nav-liquid-indicator');
  if (navbar && indicator) {
    const navItems = Array.from(navbar.querySelectorAll('.nav-item'));
    let tracking = false;
    let dragging = false;
    let startX = 0;
    let lastX = 0;
    let suppressClickUntil = 0;

    navbar.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    navbar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      tracking = true;
      dragging = false;
      startX = e.clientX;
      lastX = e.clientX;
    });

    navbar.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      const dxTotal = e.clientX - startX;
      const dxStep = e.clientX - lastX;
      lastX = e.clientX;

      if (!dragging && Math.abs(dxTotal) > 6) {
        dragging = true;
        navbar.setPointerCapture?.(e.pointerId);
        indicator.classList.add('is-dragging');
      }
      if (!dragging) return;

      const navRect = navbar.getBoundingClientRect();
      const pillW = indicator.offsetWidth || (navRect.width / Math.max(1, navItems.length));
      const minX = 8;
      const maxX = Math.max(minX, navRect.width - pillW - 8);
      const rawX = e.clientX - navRect.left - pillW / 2;
      const clampedX = Math.max(minX, Math.min(maxX, rawX));

      const vx = Math.max(-24, Math.min(24, dxStep));
      const scaleX = 1.04 + Math.min(0.11, Math.abs(vx) * 0.0045);
      const skewDeg = Math.max(-3.5, Math.min(3.5, -vx * 0.14));
      const lightPct = Math.max(12, Math.min(88, 50 + vx * 1.4));

      indicator.style.setProperty('--light-x', `${lightPct}%`);
      indicator.style.transform = `translate3d(${clampedX}px, 0, 0) scale(${scaleX.toFixed(3)}, 0.94) skewX(${skewDeg.toFixed(2)}deg)`;

      const nearest = nearestByCenterX(navItems, e.clientX);
      navItems.forEach((btn) => btn.classList.toggle('is-hover-target', btn === nearest));
    });

    const releaseNavbar = (e) => {
      if (!tracking) return;
      tracking = false;
      navItems.forEach((btn) => btn.classList.remove('is-hover-target'));
      if (!dragging) return;

      dragging = false;
      navbar.releasePointerCapture?.(e.pointerId);
      indicator.classList.remove('is-dragging');

      const nearest = nearestByCenterX(navItems, e.clientX);

      if (nearest && nearest.dataset.tab !== state.tab) {
        nearest.click();
        suppressClickUntil = performance.now() + 120;
      } else {
        positionNavIndicator(null, { animate: true });
        suppressClickUntil = performance.now() + 120;
      }
    };

    navbar.addEventListener('pointerup', releaseNavbar);
    navbar.addEventListener('pointercancel', releaseNavbar);
  }

  window.addEventListener('resize', () => {
    positionNavIndicator(null, { animate: false });
    enhanceLiquidSegmented(appMain);
  }, { passive: true });
}

queueMicrotask(initMicroInteractions);

function renderApp() {
  initMicroInteractions();
  const wasAuthHidden = authView.classList.contains('hidden');
  authView.classList.add('hidden');
  appShell.classList.remove('hidden');
  updateHeaderAndNav();

  let dir = null;
  if (!wasAuthHidden) {
    dir = 'up';
  } else if (lastRenderedTab !== null) {
    if (lastRenderedTab !== state.tab) {
      const oldIdx = TAB_ORDER.indexOf(lastRenderedTab);
      const newIdx = TAB_ORDER.indexOf(state.tab);
      dir = newIdx > oldIdx ? 'left' : 'right';
    } else if (lastRenderedSubpage !== state.lainnyaSubpage) {
      dir = state.lainnyaSubpage ? 'left' : 'right';
    }
  }
  const animateNav = wasAuthHidden && lastRenderedTab !== null;
  lastRenderedTab = state.tab;
  lastRenderedSubpage = state.lainnyaSubpage;

  if (state.tab === 'beranda') renderBeranda(appMain, ctx);
  else if (state.tab === 'transaksi') renderTransaksi(appMain, ctx);
  else if (state.tab === 'kalender') renderKalender(appMain, ctx);
  else if (state.tab === 'anggaran') renderAnggaran(appMain, ctx);
  else if (state.tab === 'lainnya') renderLainnya(appMain, ctx, state.lainnyaSubpage);

  animateMainView(dir);
  requestAnimationFrame(() => {
    positionNavIndicator(null, { animate: animateNav });
    enhanceLiquidSegmented(appMain);
  });

  appMain.scrollTop = 0;
  document.querySelector('.mobile-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('top-header')?.classList.remove('is-scrolled');
}

async function syncFromSheetsOnLoad(user) {
  if (!user || lastSyncedUserId === user.user_id) return;
  lastSyncedUserId = user.user_id;

  const hasLocalData = db.getTransactions().length > 0 || db.getWallets().length > 0;
  let showingSkeleton = false;
  if (!hasLocalData && state.tab === 'beranda') {
    showingSkeleton = true;
    appMain.innerHTML = renderSkeleton('dashboard');
  }

  try {
    const pullRes = await db.pullFromBackend(user.user_id, user.username || user.email);
    const modalClosed = document.getElementById('modal-root')?.classList.contains('hidden');
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
    const skeletonVisible = !!appMain.querySelector('.skeleton-stack');

    if (pullRes?.ok && pullRes.hasData) {
      if (modalClosed && !isTyping && db.getSessionUserId() === user.user_id) {
        renderApp();
      }
    } else {
      if (showingSkeleton && skeletonVisible && db.getSessionUserId() === user.user_id) {
        renderApp();
      }
      if (pullRes?.ok && !pullRes.hasData) {
        // Spreadsheet masih kosong untuk user ini -> kirim data awal sekali saja
        await db.syncToBackend(user);
      }
    }
  } catch {
    if (showingSkeleton && appMain.querySelector('.skeleton-stack') && db.getSessionUserId() === user.user_id) {
      renderApp();
    }
  }
}

function renderRoot() {
  const user = db.getCurrentUser();
  if (!user) {
    lastSyncedUserId = null;
    renderAuthView();
  } else {
    db.processDueRecurring(user.user_id);
    renderApp();
    syncFromSheetsOnLoad(user);
  }
}

function bindShellEvents() {
  hydrateIcons(document);

  document.querySelectorAll('#bottom-navbar .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-tab');
      state.lainnyaSubpage = null;
      renderApp();
    });
  });

  document.getElementById('btn-brand-home')?.addEventListener('click', () => {
    ctx.navigate('beranda');
  });

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const next = cycleThemeMode();
    if (db.getCurrentUser()) {
      db.setSetting('theme_mode', next);
      renderApp();
    }
    showToast(`${THEME_LABELS[next]} diaktifkan.`, 'info');
  });

  document.getElementById('btn-quick-scan')?.addEventListener('click', () => {
    ctx.openScanner();
  });

  document.getElementById('btn-notifications')?.addEventListener('click', () => {
    openNotificationsModal();
  });

  document.getElementById('btn-user-avatar')?.addEventListener('click', () => {
    ctx.openSubpage('profil');
  });

  fabBtn?.addEventListener('click', () => {
    openTransactionModal({ onSaved: () => ctx.refresh() });
  });
}

function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// Bootstrap: mewajibkan login terlebih dahulu sebelum masuk ke sistem
function init() {
  applyThemeMode(getSavedTheme(), { persist: false });
  bindShellEvents();
  renderRoot();
  registerPWA();
}

init();
