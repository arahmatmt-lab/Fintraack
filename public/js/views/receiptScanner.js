/**
 * FINTRACK — Scan Struk Pengeluaran (Bagian 6 Dokumen Rancangan)
 * Mengambil foto struk langsung dari kamera atau galeri, mengekstrak Total Pengeluaran
 * (otomatis via Gemini Vision bila aktif atau input manual terpandu), lalu mencatat ke Pengeluaran.
 */

import { db } from '../db.js';
import { esc, formatRp, icon, openModal, renderSkeleton, showToast, todayISO } from '../utils.js';
import { wireCategorySelectWithAdd } from './categoryPicker.js';

function prepareReceiptImage(file, maxDim = 1280, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: rawUrl, mimeType: file.type || 'image/jpeg' });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), mimeType: 'image/jpeg' });
      };
      img.onerror = () => resolve({ dataUrl: rawUrl, mimeType: file.type || 'image/jpeg' });
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function openReceiptScannerModal(onSaved) {
  const wallets = db.getWallets(false);

  const html = `
    <div id="scanner-stage">
      <div class="neu-inset-box" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <div style="font-size:12.5px;font-weight:800;color:var(--navy);">
            1. Foto atau Pilih Foto Struk Belanja
          </div>
          <span id="scanner-api-pill" class="badge badge-navy">Cek API AI...</span>
        </div>
        <p style="margin:0 0 10px;font-size:11.5px;color:var(--slate-soft);">
          Ambil foto langsung dari kamera atau pilih dari galeri untuk mencatat total pengeluaran belanja Anda.
        </p>
        <input type="file" id="receipt-camera-input" accept="image/*" capture="environment" class="sr-only-file" />
        <input type="file" id="receipt-gallery-input" accept="image/*" class="sr-only-file" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" id="btn-camera-receipt" class="btn-glass-primary btn-sm">
            <span class="icon-slot">${icon('camera')}</span> Foto Struk
          </button>
          <label for="receipt-gallery-input" id="btn-gallery-receipt" class="btn-glass-emerald btn-sm">
            <span class="icon-slot">${icon('image')}</span> Ambil dari Galeri
          </label>
        </div>
      </div>

      <div id="scanner-live-wrap" class="scanner-live-wrap hidden">
        <div class="scanner-live-frame">
          <video id="scanner-video" autoplay playsinline muted></video>
          <div class="scanner-live-guide" aria-hidden="true"></div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="btn-snap-photo" class="btn-glass-primary btn-sm" style="flex:1;">
            <span class="icon-slot">${icon('camera')}</span> Jepret Foto Struk
          </button>
          <label for="receipt-camera-input" class="btn-glass btn-sm">Pilih File</label>
          <button type="button" id="btn-cancel-camera" class="btn-glass-subtle btn-sm">Batal</button>
        </div>
      </div>

      <div id="scanner-preview-wrap" class="hidden" style="margin-bottom:12px;">
        <img id="scanner-preview-img" alt="Preview Struk" class="scanner-preview-frame" />
      </div>

      <div id="scanner-status" class="hidden" style="margin-bottom:12px;"></div>

      <form id="scanner-confirm-form" class="hidden">
        <div class="neu-card-sm" style="margin-bottom:12px;">
          <div style="font-size:12.5px;font-weight:800;color:var(--navy);margin-bottom:10px;">
            2. Konfirmasi Total Pengeluaran
          </div>

          <div class="form-group">
            <label class="form-label">Total Pengeluaran (Rp) *</label>
            <input type="number" class="neu-input tabular" id="rcp-total" min="1" step="1" placeholder="Masukkan total pengeluaran dari struk" style="font-size:17px;font-weight:800;" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Dompet *</label>
              <select class="neu-select" id="rcp-wallet" required>
                ${wallets.map((w) => `<option value="${esc(w.wallet_id)}">${esc(w.wallet_name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <div class="cat-label-row">
                <label class="form-label" for="rcp-category" style="margin:0;">Kategori *</label>
                <button type="button" id="btn-rcp-add-cat" class="cat-inline-add">+ Tambah</button>
              </div>
              <select class="neu-select" id="rcp-category" required></select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Toko / Keterangan</label>
              <input type="text" class="neu-input" id="rcp-merchant" placeholder="Opsional (misal: Indomaret)" />
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal Struk *</label>
              <input type="date" class="neu-input" id="rcp-date" required />
            </div>
          </div>

          <details class="neu-accordion" style="margin-top:4px;">
            <summary style="font-size:12px;font-weight:700;color:var(--slate-soft);">
              <span>Rincian Subtotal, Pajak &amp; Diskon (Opsional)</span>
              <span class="accordion-chevron" style="width:24px;height:24px;">${icon('chevronDown')}</span>
            </summary>
            <div class="accordion-body" style="gap:10px;">
              <div class="form-row">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Subtotal (Rp)</label>
                  <input type="number" class="neu-input" id="rcp-subtotal" min="0" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Pajak (Rp)</label>
                  <input type="number" class="neu-input" id="rcp-tax" min="0" />
                </div>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Diskon (Rp)</label>
                <input type="number" class="neu-input" id="rcp-discount" min="0" />
              </div>
              <div>
                <div class="section-head" style="margin-bottom:6px;">
                  <span style="font-size:12px;font-weight:700;color:var(--navy);">Rincian Item</span>
                  <button type="button" id="btn-add-rcp-item" class="btn-glass btn-sm">+ Item</button>
                </div>
                <div id="rcp-items-list" style="display:flex;flex-direction:column;gap:8px;"></div>
              </div>
            </div>
          </details>
        </div>

        <button type="submit" class="btn-glass-emerald btn-block">
          Simpan Total Pengeluaran Struk
        </button>
      </form>
    </div>
  `;

  openModal('Scan Struk Belanja', html, (rootEl, close) => {
    const cameraInput = rootEl.querySelector('#receipt-camera-input');
    const galleryInput = rootEl.querySelector('#receipt-gallery-input');
    const liveWrap = rootEl.querySelector('#scanner-live-wrap');
    const videoEl = rootEl.querySelector('#scanner-video');
    const apiPill = rootEl.querySelector('#scanner-api-pill');
    const previewWrap = rootEl.querySelector('#scanner-preview-wrap');
    const previewImg = rootEl.querySelector('#scanner-preview-img');
    const statusBox = rootEl.querySelector('#scanner-status');
    const confirmForm = rootEl.querySelector('#scanner-confirm-form');
    const itemsContainer = rootEl.querySelector('#rcp-items-list');
    const catSelect = rootEl.querySelector('#rcp-category');
    const refillRcpCategories = wireCategorySelectWithAdd({
      selectEl: catSelect,
      addBtnEl: rootEl.querySelector('#btn-rcp-add-cat'),
      getType: () => 'expense',
      lockType: true
    });

    let currentItems = [];
    let currentImageUrl = '';
    let activeStream = null;

    function stopCamera() {
      if (activeStream) {
        for (const track of activeStream.getTracks()) {
          try { track.stop(); } catch (_) {}
        }
        activeStream = null;
      }
      if (videoEl) videoEl.srcObject = null;
      liveWrap?.classList.add('hidden');
    }

    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((health) => {
        if (!apiPill || !apiPill.isConnected) return;
        if (health?.geminiConfigured) {
          apiPill.className = 'badge badge-emerald';
          apiPill.textContent = 'Gemini AI Aktif';
        } else {
          apiPill.className = 'badge badge-warn';
          apiPill.textContent = 'API AI Belum Diatur';
        }
      })
      .catch(() => {
        if (apiPill && apiPill.isConnected) {
          apiPill.className = 'badge badge-warn';
          apiPill.textContent = 'Mode Manual';
        }
      });

    function renderItems() {
      if (currentItems.length === 0) {
        itemsContainer.innerHTML = `<div class="text-muted" style="font-size:11.5px;">Belum ada rincian barang.</div>`;
        return;
      }
      itemsContainer.innerHTML = currentItems
        .map(
          (it, idx) => `
          <div class="neu-inset-box" style="padding:8px;display:grid;grid-template-columns:minmax(0, 1.5fr) 54px 86px 28px;gap:6px;align-items:center;">
            <input type="text" class="neu-input rcp-it-name" data-idx="${idx}" value="${esc(it.item_name)}" placeholder="Nama item" style="padding:7px 8px;font-size:12px;" />
            <input type="number" class="neu-input rcp-it-qty" data-idx="${idx}" value="${Number(it.quantity || 1)}" min="1" style="padding:7px 6px;font-size:12px;" />
            <input type="number" class="neu-input rcp-it-price" data-idx="${idx}" value="${Number(it.unit_price || 0)}" min="0" style="padding:7px 6px;font-size:12px;" />
            <button type="button" class="btn-glass-danger btn-sm rcp-it-del" data-idx="${idx}" style="padding:6px;border-radius:9px;">×</button>
          </div>
        `
        )
        .join('');

      itemsContainer.querySelectorAll('.rcp-it-name').forEach((inp) => {
        inp.addEventListener('input', () => {
          currentItems[Number(inp.dataset.idx)].item_name = inp.value;
        });
      });
      itemsContainer.querySelectorAll('.rcp-it-qty').forEach((inp) => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.dataset.idx);
          currentItems[idx].quantity = Number(inp.value || 1);
          currentItems[idx].total_price = currentItems[idx].quantity * Number(currentItems[idx].unit_price || 0);
        });
      });
      itemsContainer.querySelectorAll('.rcp-it-price').forEach((inp) => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.dataset.idx);
          currentItems[idx].unit_price = Number(inp.value || 0);
          currentItems[idx].total_price = Number(currentItems[idx].quantity || 1) * currentItems[idx].unit_price;
        });
      });
      itemsContainer.querySelectorAll('.rcp-it-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentItems.splice(Number(btn.dataset.idx), 1);
          renderItems();
        });
      });
    }

    function populateForm(payload) {
      const isGemini = payload?.source === 'gemini_api';
      const rawData = payload?.data || {};
      const val = payload?.validation || {};
      const detectedTotal = isGemini ? Number(rawData.total_amount || 0) : 0;

      confirmForm.classList.remove('hidden');

      rootEl.querySelector('#rcp-merchant').value = isGemini ? (rawData.merchant_name || '') : '';
      rootEl.querySelector('#rcp-date').value = isGemini && rawData.receipt_date ? rawData.receipt_date : todayISO();
      rootEl.querySelector('#rcp-subtotal').value = isGemini ? Number(rawData.subtotal || 0) : 0;
      rootEl.querySelector('#rcp-tax').value = isGemini ? Number(rawData.tax || 0) : 0;
      rootEl.querySelector('#rcp-discount').value = isGemini ? Number(rawData.discount || 0) : 0;
      const totalInput = rootEl.querySelector('#rcp-total');
      totalInput.value = detectedTotal > 0 ? detectedTotal : '';

      refillRcpCategories();
      const suggested = String(rawData.suggested_category || '').toLowerCase();
      const currentExpenseCats = db.getCategories('expense');
      const matchedCat = isGemini && suggested
        ? currentExpenseCats.find((c) => c.category_name.toLowerCase().includes(suggested) || suggested.includes(c.category_name.toLowerCase()))
        : null;
      if (matchedCat) catSelect.value = matchedCat.category_id;

      currentItems = isGemini && Array.isArray(rawData.items)
        ? rawData.items.map((it) => ({
            item_name: it.item_name || '',
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            total_price: Number(it.total_price || Number(it.quantity || 1) * Number(it.unit_price || 0))
          }))
        : [];
      renderItems();

      statusBox.classList.remove('hidden');
      if (isGemini && detectedTotal > 0) {
        const badgeClass = val.is_consistent ? 'badge-emerald' : 'badge-warn';
        statusBox.innerHTML = `
          <div class="neu-card-sm">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <span class="badge ${badgeClass}">Total Terbaca: ${formatRp(detectedTotal)}</span>
              <span style="font-size:11px;color:var(--slate-soft);">Gemini OCR</span>
            </div>
            <div style="font-size:11.5px;color:var(--slate);">${esc(val.note || 'Periksa kembali Total Pengeluaran sebelum menyimpan.')}</div>
          </div>
        `;
      } else {
        statusBox.innerHTML = `
          <div class="neu-card-sm">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <span class="badge badge-blue">Foto Struk Siap</span>
              <span style="font-size:11px;color:var(--slate-soft);">Input Total</span>
            </div>
            <div style="font-size:11.5px;color:var(--slate);">
              ${esc(payload?.warning || 'Masukkan Total Pengeluaran yang tertera pada foto struk Anda, lalu simpan.')}
            </div>
          </div>
        `;
        setTimeout(() => totalInput.focus(), 60);
      }
    }

    async function runScan({ imageDataUrl, mimeType, fileName }) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = `${renderSkeleton('receipt')}<p class="text-xs text-muted" style="margin-top:6px;font-weight:700;color:var(--blue);text-align:center;">Memindai foto struk belanja...</p>`;
      try {
        const res = await fetch('/api/receipts/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl, mimeType, fileName })
        });
        if (!res.ok) throw new Error('Gagal menghubungi layanan pindai struk.');
        const result = await res.json();
        populateForm(result);
      } catch (err) {
        statusBox.innerHTML = `<div class="neu-card-sm text-danger" style="font-size:12px;">${esc(err.message)}</div>`;
      }
    }

    async function processCapturedImage({ dataUrl, mimeType, fileName }) {
      currentImageUrl = dataUrl;
      previewImg.src = currentImageUrl;
      previewWrap.classList.remove('hidden');
      await runScan({ imageDataUrl: currentImageUrl, mimeType, fileName });
    }

    async function handleFileSelected(file) {
      if (!file) return;
      stopCamera();
      try {
        const prepared = await prepareReceiptImage(file);
        await processCapturedImage({
          dataUrl: prepared.dataUrl,
          mimeType: prepared.mimeType,
          fileName: file.name
        });
      } catch (err) {
        showToast(err?.message || 'Gagal memproses foto struk.', 'error');
      }
    }

    function showCameraFallbackNotice(reason) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = `
        <div class="neu-card-sm">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px;">
            ${esc(reason)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <label for="receipt-camera-input" class="btn-glass-primary btn-sm">Pilih Foto / Kamera Sistem</label>
            <label for="receipt-gallery-input" class="btn-glass-emerald btn-sm">Ambil dari Galeri</label>
          </div>
        </div>
      `;
    }

    async function openLiveCamera() {
      stopCamera();
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        showCameraFallbackNotice('Browser ini tidak mendukung kamera langsung. Silakan pilih file foto struk atau ambil dari galeri.');
        cameraInput.click();
        return;
      }
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false
        });
        videoEl.srcObject = activeStream;
        await videoEl.play();
        liveWrap.classList.remove('hidden');
      } catch (_) {
        stopCamera();
        showCameraFallbackNotice('Kamera langsung tidak tersedia atau izin ditolak. Pilih foto dari file/kamera sistem atau galeri.');
        cameraInput.click();
      }
    }

    async function snapLivePhoto() {
      if (!videoEl || !videoEl.videoWidth) {
        showToast('Kamera belum siap, tunggu sebentar lalu coba lagi.', 'error');
        return;
      }
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(videoEl.videoWidth, videoEl.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      stopCamera();
      await processCapturedImage({ dataUrl, mimeType: 'image/jpeg', fileName: 'foto-struk.jpg' });
    }

    rootEl.querySelector('#btn-camera-receipt')?.addEventListener('click', openLiveCamera);
    rootEl.querySelector('#btn-snap-photo')?.addEventListener('click', snapLivePhoto);
    rootEl.querySelector('#btn-cancel-camera')?.addEventListener('click', stopCamera);

    cameraInput.addEventListener('change', (e) => {
      handleFileSelected(e.target.files?.[0]);
      e.target.value = '';
    });
    galleryInput.addEventListener('change', (e) => {
      handleFileSelected(e.target.files?.[0]);
      e.target.value = '';
    });

    rootEl.querySelector('#btn-add-rcp-item')?.addEventListener('click', () => {
      currentItems.push({ item_name: '', quantity: 1, unit_price: 0, total_price: 0 });
      renderItems();
    });

    confirmForm.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const merchant = rootEl.querySelector('#rcp-merchant').value.trim();
        const txDate = rootEl.querySelector('#rcp-date').value;
        const walletId = rootEl.querySelector('#rcp-wallet').value;
        const catId = rootEl.querySelector('#rcp-category').value;
        const subtotal = Number(rootEl.querySelector('#rcp-subtotal').value || 0);
        const tax = Number(rootEl.querySelector('#rcp-tax').value || 0);
        const discount = Number(rootEl.querySelector('#rcp-discount').value || 0);
        const total = Number(rootEl.querySelector('#rcp-total').value || 0);

        if (!catId) throw new Error('Pilih atau tambahkan kategori terlebih dahulu.');
        if (total <= 0) throw new Error('Total pengeluaran harus lebih besar dari nol.');

        db.saveScannedReceipt({
          transactionPayload: {
            wallet_id: walletId,
            category_id: catId,
            amount: total,
            transaction_date: txDate,
            description: merchant ? `Struk: ${merchant}` : 'Belanja (Scan Struk)',
            attachment_url: null
          },
          receiptData: {
            merchant_name: merchant || 'Belanja Struk',
            receipt_date: txDate,
            subtotal: subtotal || total,
            tax,
            discount,
            total_amount: total,
            image_url: currentImageUrl,
            items: currentItems.filter((it) => it.item_name.trim())
          }
        });

        showToast(`Pengeluaran ${formatRp(total)} berhasil dicatat!`, 'success');
        stopCamera();
        close();
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    return stopCamera;
  });
}
