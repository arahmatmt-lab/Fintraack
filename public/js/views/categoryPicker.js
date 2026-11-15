/**
 * FINTRACK — Shared Category Picker & Creator Overlay
 * Menyediakan UI pemilihan kategori taktil dan sheet pembuatan/edit kategori
 * yang seragam di Catat Transaksi, Scan Struk, Anggaran, Transaksi Rutin, & Kelola Kategori.
 */

import { db } from '../db.js';
import { enhanceLiquidSegmented, esc, icon, showToast } from '../utils.js';

export const CATEGORY_ICONS = [
  { id: 'tag', label: 'Label' },
  { id: 'coffee', label: 'Jajan' },
  { id: 'utensils', label: 'Makan' },
  { id: 'bag', label: 'Belanja' },
  { id: 'car', label: 'Transport' },
  { id: 'bolt', label: 'Tagihan' },
  { id: 'heart', label: 'Sehat' },
  { id: 'gift', label: 'Hadiah' },
  { id: 'briefcase', label: 'Kerja' },
  { id: 'wallet', label: 'Gaji' },
  { id: 'gamepad', label: 'Hiburan' },
  { id: 'book', label: 'Edukasi' }
];

export const CATEGORY_COLORS = [
  { hex: '#1D4ED8', name: 'Biru' },
  { hex: '#10B981', name: 'Zamrud' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EF4444', name: 'Merah' },
  { hex: '#8B5CF6', name: 'Ungu' },
  { hex: '#EC4899', name: 'Rose' },
  { hex: '#0EA5E9', name: 'Langit' },
  { hex: '#14B8A6', name: 'Teal' }
];

export const CATEGORY_SUGGESTIONS = {
  expense: [
    { name: 'Jajan', icon: 'coffee', color: '#F59E0B' },
    { name: 'Makan', icon: 'utensils', color: '#1D4ED8' },
    { name: 'Belanja', icon: 'bag', color: '#EC4899' },
    { name: 'Transport', icon: 'car', color: '#0EA5E9' },
    { name: 'Tagihan', icon: 'bolt', color: '#8B5CF6' },
    { name: 'Kesehatan', icon: 'heart', color: '#10B981' }
  ],
  income: [
    { name: 'Gaji', icon: 'wallet', color: '#10B981' },
    { name: 'Bonus', icon: 'gift', color: '#F59E0B' },
    { name: 'Freelance', icon: 'briefcase', color: '#1D4ED8' },
    { name: 'Usaha', icon: 'chart', color: '#14B8A6' }
  ]
};

export function renderCategoryBadge(cat, size = 'md') {
  const color = esc(cat?.color || '#1D4ED8');
  const ico = icon(cat?.icon || 'tag');
  return `<span class="cat-icon-badge cat-icon-${size}" style="--cat-color:${color};">${ico}</span>`;
}

/**
 * Membuka bottom-sheet pembuatan/edit kategori di atas modal lain tanpa merusak form induknya.
 */
export function openCategoryCreatorOverlay({
  defaultType = 'expense',
  existing = null,
  lockType = false,
  onSaved = null
} = {}) {
  document.querySelectorAll('.cat-creator-root').forEach((el) => el.remove());

  const isEdit = Boolean(existing);
  let selectedType = existing?.category_type === 'income' ? 'income' : (defaultType === 'income' ? 'income' : 'expense');
  let selectedIcon = existing?.icon || (selectedType === 'income' ? 'wallet' : 'coffee');
  let selectedColor = existing?.color || (selectedType === 'income' ? '#10B981' : '#1D4ED8');

  const root = document.createElement('div');
  root.className = 'modal-root cat-creator-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  const renderSuggestionsHtml = (type) => {
    if (isEdit) return '';
    const items = CATEGORY_SUGGESTIONS[type] || CATEGORY_SUGGESTIONS.expense;
    return `
      <div class="cat-suggest-block">
        <span class="cat-suggest-label">Inspirasi cepat</span>
        <div class="cat-suggest-strip">
          ${items.map((s) => `
            <button type="button" class="cat-suggest-pill" data-suggest-name="${esc(s.name)}" data-suggest-icon="${esc(s.icon)}" data-suggest-color="${esc(s.color)}">
              <span class="cat-suggest-dot" style="background:${esc(s.color)};"></span>
              <span>${esc(s.name)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  };

  root.innerHTML = `
    <div class="modal-sheet cat-creator-sheet" role="document">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${isEdit ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
          <p class="cat-creator-sub">${isEdit ? 'Perbarui tampilan dan detail kategori' : 'Kategori tersimpan otomatis ke semua pilihan transaksi'}</p>
        </div>
        <button type="button" class="modal-close" id="cat-cr-close" aria-label="Tutup">&times;</button>
      </div>

      <form id="cat-creator-form" autocomplete="off">
        <div class="cat-preview-card" id="cat-preview-card">
          <div class="cat-preview-left">
            <span class="cat-icon-badge cat-icon-lg" id="cat-preview-badge" style="--cat-color:${esc(selectedColor)};">
              ${icon(selectedIcon)}
            </span>
            <div class="cat-preview-text">
              <div class="cat-preview-name" id="cat-preview-name">${esc(existing?.category_name || 'Nama Kategori')}</div>
              <div class="cat-preview-hint">Pratinjau kartu kategori Anda</div>
            </div>
          </div>
          <span class="badge ${selectedType === 'income' ? 'badge-emerald' : 'badge-navy'}" id="cat-preview-type-badge">
            ${selectedType === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </span>
        </div>

        ${lockType ? `
          <div class="cat-locked-type">
            <span>Jenis:</span>
            <span class="badge ${selectedType === 'income' ? 'badge-emerald' : 'badge-navy'}">${selectedType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label">Jenis Kategori</label>
            <div class="neu-segmented" data-seg-key="cat-creator-type">
              <button type="button" class="neu-seg-btn ${selectedType === 'expense' ? 'active' : ''}" data-cat-type="expense">Pengeluaran</button>
              <button type="button" class="neu-seg-btn ${selectedType === 'income' ? 'active' : ''}" data-cat-type="income">Pemasukan</button>
            </div>
          </div>
        `}

        <div class="form-group">
          <label class="form-label" for="cat-cr-name">Nama Kategori *</label>
          <input
            type="text"
            id="cat-cr-name"
            class="neu-input"
            maxlength="32"
            placeholder="${selectedType === 'income' ? 'Contoh: Gaji, Bonus, Freelance' : 'Contoh: Jajan, Kopi, Parkir'}"
            value="${esc(existing?.category_name || '')}"
            required
          />
          <div id="cat-suggest-host">${renderSuggestionsHtml(selectedType)}</div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Ikon</label>
          <div class="cat-icon-grid" id="cat-icon-grid">
            ${CATEGORY_ICONS.map((item) => `
              <button
                type="button"
                class="cat-icon-opt ${selectedIcon === item.id ? 'active' : ''}"
                data-icon-opt="${esc(item.id)}"
                title="${esc(item.label)}"
                aria-label="${esc(item.label)}"
                style="--cat-color:${esc(selectedColor)};"
              >
                <span class="cat-icon-opt-glyph">${icon(item.id)}</span>
                <span class="cat-icon-opt-label">${esc(item.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Warna Aksen</label>
          <div class="cat-color-row" id="cat-color-row">
            ${CATEGORY_COLORS.map((c) => `
              <button
                type="button"
                class="cat-color-swatch ${selectedColor.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}"
                data-color-opt="${esc(c.hex)}"
                aria-label="${esc(c.name)}"
                title="${esc(c.name)}"
                style="--swatch:${esc(c.hex)};"
              ></button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:4px;">
          ${isEdit ? `<button type="button" id="cat-cr-delete" class="btn-glass-danger" style="flex:0 0 auto;">${icon('trash')} Hapus</button>` : ''}
          <button type="submit" class="btn-glass-primary" style="flex:1;">
            ${isEdit ? 'Simpan Perubahan' : 'Simpan Kategori'}
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(root);

  const nameInput = root.querySelector('#cat-cr-name');
  const previewBadge = root.querySelector('#cat-preview-badge');
  const previewName = root.querySelector('#cat-preview-name');
  const previewTypeBadge = root.querySelector('#cat-preview-type-badge');
  const suggestHost = root.querySelector('#cat-suggest-host');

  const closeOverlay = () => {
    document.removeEventListener('keydown', onKeyDown);
    root.remove();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeOverlay();
  };
  document.addEventListener('keydown', onKeyDown);

  const syncPreview = () => {
    const val = nameInput.value.trim();
    previewName.textContent = val || 'Nama Kategori';
    previewName.classList.toggle('is-placeholder', !val);
    previewBadge.style.setProperty('--cat-color', selectedColor);
    previewBadge.innerHTML = icon(selectedIcon);
    previewTypeBadge.className = `badge ${selectedType === 'income' ? 'badge-emerald' : 'badge-navy'}`;
    previewTypeBadge.textContent = selectedType === 'income' ? 'Pemasukan' : 'Pengeluaran';

    root.querySelectorAll('[data-icon-opt]').forEach((btn) => {
      const ico = btn.getAttribute('data-icon-opt');
      btn.style.setProperty('--cat-color', selectedColor);
      btn.classList.toggle('active', ico === selectedIcon);
    });
    root.querySelectorAll('[data-color-opt]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-color-opt').toLowerCase() === selectedColor.toLowerCase());
    });
  };

  const bindSuggestPills = () => {
    root.querySelectorAll('[data-suggest-name]').forEach((pill) => {
      pill.addEventListener('click', () => {
        nameInput.value = pill.getAttribute('data-suggest-name') || '';
        selectedIcon = pill.getAttribute('data-suggest-icon') || selectedIcon;
        selectedColor = pill.getAttribute('data-suggest-color') || selectedColor;
        syncPreview();
        nameInput.focus();
      });
    });
  };

  enhanceLiquidSegmented(root);
  bindSuggestPills();
  syncPreview();
  setTimeout(() => nameInput.focus(), 40);

  nameInput.addEventListener('input', syncPreview);

  root.querySelector('#cat-cr-close').addEventListener('click', closeOverlay);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeOverlay();
  });

  root.querySelectorAll('[data-cat-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.getAttribute('data-cat-type') === 'income' ? 'income' : 'expense';
      if (nextType === selectedType) return;
      selectedType = nextType;
      root.querySelectorAll('[data-cat-type]').forEach((b) => b.classList.toggle('active', b === btn));
      nameInput.placeholder = selectedType === 'income' ? 'Contoh: Gaji, Bonus, Freelance' : 'Contoh: Jajan, Kopi, Parkir';
      if (!isEdit) {
        selectedIcon = selectedType === 'income' ? 'wallet' : 'coffee';
        selectedColor = selectedType === 'income' ? '#10B981' : '#1D4ED8';
        suggestHost.innerHTML = renderSuggestionsHtml(selectedType);
        bindSuggestPills();
      }
      syncPreview();
    });
  });

  root.querySelectorAll('[data-icon-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedIcon = btn.getAttribute('data-icon-opt') || 'tag';
      syncPreview();
    });
  });

  root.querySelectorAll('[data-color-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedColor = btn.getAttribute('data-color-opt') || '#1D4ED8';
      syncPreview();
    });
  });

  root.querySelector('#cat-cr-delete')?.addEventListener('click', () => {
    try {
      db.deleteCustomCategory(existing.category_id);
      showToast(`Kategori "${existing.category_name}" dihapus.`, 'info');
      closeOverlay();
      if (typeof onSaved === 'function') onSaved(null, { deleted: true });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  root.querySelector('#cat-creator-form').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const payload = {
        category_name: nameInput.value,
        category_type: selectedType,
        icon: selectedIcon,
        color: selectedColor
      };
      const saved = isEdit
        ? db.updateCustomCategory(existing.category_id, payload)
        : db.addCustomCategory(payload);
      showToast(isEdit ? `Kategori "${saved.category_name}" diperbarui.` : `Kategori "${saved.category_name}" ditambahkan.`, 'success');
      closeOverlay();
      if (typeof onSaved === 'function') onSaved(saved, { deleted: false });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Merender pemilih kategori taktil di modal Catat Transaksi dan menyinkronkannya ke input tersembunyi `#tx-category`.
 */
export function mountTransactionCategoryPicker({
  hostEl,
  hiddenInput,
  initialType = 'expense',
  initialCategoryId = '',
  onTypeSwitch = null
}) {
  let currentType = initialType === 'income' ? 'income' : 'expense';
  const lastSelectedByType = {
    expense: currentType === 'expense' ? initialCategoryId : '',
    income: currentType === 'income' ? initialCategoryId : ''
  };

  function render(type = currentType) {
    currentType = type === 'income' ? 'income' : 'expense';
    const cats = db.getCategories(currentType);

    let chosenId = lastSelectedByType[currentType];
    if (!cats.some((c) => c.category_id === chosenId)) {
      chosenId = cats[0]?.category_id || '';
      lastSelectedByType[currentType] = chosenId;
    }
    hiddenInput.value = chosenId;

    const typeLabel = currentType === 'income' ? 'Pemasukan' : 'Pengeluaran';
    hostEl.innerHTML = `
      <div class="cat-picker-head">
        <label class="form-label" style="margin:0;">Kategori *</label>
        <button type="button" class="cat-add-trigger" data-cat-add>
          <span class="cat-add-plus">+</span> Tambah Kategori
        </button>
      </div>
      ${cats.length > 0 ? `
        <div class="cat-picker-grid" role="radiogroup" aria-label="Pilih kategori ${typeLabel}">
          ${cats.map((c) => {
            const isSelected = c.category_id === chosenId;
            return `
              <button
                type="button"
                class="cat-pick-chip ${isSelected ? 'active' : ''}"
                data-cat-id="${esc(c.category_id)}"
                role="radio"
                aria-checked="${isSelected ? 'true' : 'false'}"
                style="--cat-color:${esc(c.color || '#1D4ED8')};"
              >
                ${renderCategoryBadge(c, 'sm')}
                <span class="cat-pick-name">${esc(c.category_name)}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="cat-empty-card">
          <div class="cat-empty-icon">${icon('tag')}</div>
          <div class="cat-empty-copy">
            <div class="cat-empty-title">Belum ada kategori ${typeLabel}</div>
            <div class="cat-empty-desc">Tambahkan kategori seperti ${currentType === 'income' ? 'Gaji atau Bonus' : 'Jajan, Makan, atau Transport'} untuk mulai mencatat.</div>
          </div>
          <button type="button" class="btn-glass-emerald btn-sm cat-empty-btn" data-cat-add>+ Buat Kategori</button>
        </div>
      `}
    `;

    hostEl.querySelectorAll('[data-cat-id]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const picked = chip.getAttribute('data-cat-id') || '';
        lastSelectedByType[currentType] = picked;
        hiddenInput.value = picked;
        hostEl.querySelectorAll('[data-cat-id]').forEach((other) => {
          const on = other === chip;
          other.classList.toggle('active', on);
          other.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      });
    });

    hostEl.querySelectorAll('[data-cat-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openCategoryCreatorOverlay({
          defaultType: currentType,
          lockType: false,
          onSaved: (saved) => {
            if (!saved) return;
            lastSelectedByType[saved.category_type] = saved.category_id;
            if (saved.category_type !== currentType && typeof onTypeSwitch === 'function') {
              onTypeSwitch(saved.category_type);
            } else {
              render(saved.category_type);
            }
          }
        });
      });
    });
  }

  render(currentType);

  return {
    setType(type) {
      render(type);
    },
    refresh() {
      render(currentType);
    }
  };
}

/**
 * Mengisi `<select>` kategori secara dinamis dan menghubungkan tombol "+ Tambah" agar langsung memperbarui pilihan.
 */
export function wireCategorySelectWithAdd({
  selectEl,
  addBtnEl,
  getType = () => 'expense',
  lockType = true,
  prefixOptionsHtml = '',
  optionLabelPrefix = '',
  emptyLabel = 'Belum ada kategori — klik + Tambah'
}) {
  if (!selectEl) return () => {};

  const refill = (preferredId = null) => {
    const type = getType();
    const cats = db.getCategories(type || null);
    const prevValue = preferredId !== null ? preferredId : selectEl.value;
    const catOptions = cats
      .map((c) => `<option value="${esc(c.category_id)}">${esc(optionLabelPrefix + c.category_name)}</option>`)
      .join('');

    if (prefixOptionsHtml) {
      selectEl.innerHTML = `${prefixOptionsHtml}${catOptions}`;
    } else if (cats.length === 0) {
      selectEl.innerHTML = `<option value="">${esc(emptyLabel)}</option>`;
    } else {
      selectEl.innerHTML = catOptions;
    }

    if (prevValue && Array.from(selectEl.options).some((opt) => opt.value === prevValue)) {
      selectEl.value = prevValue;
    }
  };

  refill();

  addBtnEl?.addEventListener('click', () => {
    const resolvedType = getType();
    openCategoryCreatorOverlay({
      defaultType: resolvedType === 'income' ? 'income' : 'expense',
      lockType: Boolean(lockType && resolvedType),
      onSaved: (saved) => {
        if (!saved) return;
        refill(saved.category_id);
      }
    });
  });

  return refill;
}
