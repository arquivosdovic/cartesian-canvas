/**
 * sidebar.js
 * Manages all sidebar interactions: labels, add-element form,
 * element list rendering, score panel, edit modal, and coordinates display.
 */

import {
  state,
  subscribe,
  setLabel,
  addElement,
  removeElement,
  updateElementScores,
  updateElementMeta,
  selectElement,
  getSelected,
} from './store.js';
import { evictImageCache } from './renderer.js';

let pendingPhotoDataUrl = null;

export function initSidebar() {
  bindLabelInputs();
  bindAddForm();
  bindScoreInputs();
  subscribe(onStateChange);
}

// ── Label inputs ─────────────────────────────────────────────────────────────

function bindLabelInputs() {
  const ids  = ['lTop', 'lBottom', 'lLeft', 'lRight'];
  const dirs = ['top', 'bottom', 'left', 'right'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.labels[dirs[i]];
    el.addEventListener('input', () => setLabel(dirs[i], el.value));
  });
}

// ── Add element form ──────────────────────────────────────────────────────────

function bindAddForm() {
  const photoInput = document.getElementById('newPhoto');
  const preview    = document.getElementById('photoPreview');
  const btnAdd     = document.getElementById('btnAdd');

  photoInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      pendingPhotoDataUrl = ev.target.result;
      preview.src = pendingPhotoDataUrl;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  btnAdd?.addEventListener('click', () => {
    const nameInput = document.getElementById('newName');
    const name = nameInput?.value.trim();
    if (!name) { nameInput?.focus(); return; }

    addElement({
      id: Date.now(),
      name,
      photo: pendingPhotoDataUrl,
      scores: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    nameInput.value = '';
    pendingPhotoDataUrl = null;
    preview.src = '';
    preview.style.display = 'none';
    photoInput.value = '';
  });

  document.getElementById('newName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnAdd?.click();
  });
}

// ── Score inputs ──────────────────────────────────────────────────────────────

function bindScoreInputs() {
  ['sTop', 'sBottom', 'sLeft', 'sRight'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', pushScores);
  });
}

function pushScores() {
  const selected = getSelected();
  if (!selected) return;
  updateElementScores(selected.id, {
    top:    parseFloat(document.getElementById('sTop').value)    || 0,
    bottom: parseFloat(document.getElementById('sBottom').value) || 0,
    left:   parseFloat(document.getElementById('sLeft').value)   || 0,
    right:  parseFloat(document.getElementById('sRight').value)  || 0,
  });
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function openEditModal(el) {
  // Remove existing modal if any
  document.getElementById('editModal')?.remove();

  let editPhoto = el.photo;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'editModal';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Editar elemento">
      <p class="modal__title">Editar — ${escapeHtml(el.name)}</p>
      <div class="form-group">
        <label class="form-label" for="editName">Nome</label>
        <input class="form-input" type="text" id="editName" value="${escapeHtml(el.name)}">
      </div>
      <div class="form-group form-group--row">
        <label class="form-label">Foto</label>
        <label class="btn-upload" for="editPhoto">
          <i class="ti ti-upload" aria-hidden="true"></i> Trocar foto
          <input type="file" accept="image/*" id="editPhoto" style="display:none">
        </label>
        <img id="editPhotoPreview" class="photo-preview"
             src="${el.photo || ''}"
             alt="Preview"
             style="display:${el.photo ? 'block' : 'none'}">
        ${el.photo ? `<button class="btn btn--icon btn--danger" id="editPhotoRemove" title="Remover foto"><i class="ti ti-x"></i></button>` : ''}
      </div>
      <div class="modal__actions">
        <button class="btn" id="editCancel">Cancelar</button>
        <button class="btn btn--primary" id="editSave">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#editName');
  const photoInput = overlay.querySelector('#editPhoto');
  const preview   = overlay.querySelector('#editPhotoPreview');

  photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      editPhoto = ev.target.result;
      preview.src = editPhoto;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  overlay.querySelector('#editPhotoRemove')?.addEventListener('click', () => {
    editPhoto = null;
    preview.src = '';
    preview.style.display = 'none';
  });

  overlay.querySelector('#editCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#editSave').addEventListener('click', () => {
    const newName = nameInput.value.trim();
    if (!newName) { nameInput.focus(); return; }
    evictImageCache(el.id);
    updateElementMeta(el.id, { name: newName, photo: editPhoto });
    overlay.remove();
  });

  nameInput.focus();
  nameInput.select();
}

// ── State reactions ───────────────────────────────────────────────────────────

function onStateChange(st) {
  renderElementList(st);
  renderScorePanel(st);
  syncScoreLabels(st);
  syncLabelInputs(st);
}

function syncLabelInputs({ labels }) {
  const map = { lTop: labels.top, lBottom: labels.bottom, lLeft: labels.left, lRight: labels.right };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && el.value !== value) el.value = value;
  });
}

function renderElementList({ elements, selectedId }) {
  const list = document.getElementById('elemList');
  if (!list) return;

  if (!elements.length) {
    list.innerHTML = '<p class="empty-state">Nenhum elemento ainda.</p>';
    return;
  }

  list.innerHTML = elements.map(el => `
    <div class="elem-item ${el.id === selectedId ? 'elem-item--active' : ''}"
         data-id="${el.id}"
         role="button"
         tabindex="0"
         aria-label="Selecionar ${escapeHtml(el.name)}">
      ${el.photo
        ? `<img class="elem-item__avatar" src="${el.photo}" alt="${escapeHtml(el.name)}">`
        : `<div class="elem-item__initials" aria-hidden="true">${initials(el.name)}</div>`
      }
      <span class="elem-item__name">${escapeHtml(el.name)}</span>
      <button class="btn btn--icon elem-item__edit-btn"
              data-edit="${el.id}"
              aria-label="Editar ${escapeHtml(el.name)}"
              title="Editar">
        <i class="ti ti-pencil" aria-hidden="true"></i>
      </button>
      <button class="btn btn--icon btn--danger"
              data-remove="${el.id}"
              aria-label="Remover ${escapeHtml(el.name)}"
              title="Remover">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.elem-item').forEach(item => {
    const id = Number(item.dataset.id);
    item.addEventListener('click', e => {
      if (e.target.closest('[data-remove]') || e.target.closest('[data-edit]')) return;
      selectElement(id);
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectElement(id);
    });
  });

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id  = Number(btn.dataset.edit);
      const el  = state.elements.find(x => x.id === id);
      if (el) openEditModal(el);
    });
  });

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeElement(Number(btn.dataset.remove));
    });
  });
}

function calcCoords(scores) {
  const x = (scores.right - scores.left) / 10;
  const y = (scores.top   - scores.bottom) / 10;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function renderScorePanel({ selectedId, elements }) {
  const panel = document.getElementById('section-scores');
  if (!panel) return;

  const el = elements.find(e => e.id === selectedId);
  if (!el) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  document.getElementById('panelTitle').textContent = el.name;
  document.getElementById('sTop').value    = el.scores.top;
  document.getElementById('sBottom').value = el.scores.bottom;
  document.getElementById('sLeft').value   = el.scores.left;
  document.getElementById('sRight').value  = el.scores.right;

  // Coordinates display
  const coords = calcCoords(el.scores);
  let coordsEl = document.getElementById('coordsDisplay');
  if (!coordsEl) {
    coordsEl = document.createElement('div');
    coordsEl.id = 'coordsDisplay';
    coordsEl.className = 'coords-display';
    coordsEl.innerHTML = `
      <div class="coords-display__item">
        <div class="coords-display__label">X</div>
        <div class="coords-display__value" id="coordX">0</div>
      </div>
      <div class="coords-display__item">
        <div class="coords-display__label">Y</div>
        <div class="coords-display__value" id="coordY">0</div>
      </div>
    `;
    panel.appendChild(coordsEl);
  }

  const fmt = v => (v > 0 ? '+' : '') + v.toFixed(1);
  document.getElementById('coordX').textContent = fmt(coords.x);
  document.getElementById('coordY').textContent = fmt(coords.y);
}

function syncScoreLabels({ labels }) {
  const map = { sl_top: labels.top, sl_bottom: labels.bottom, sl_left: labels.left, sl_right: labels.right };
  Object.entries(map).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || id.replace('sl_', '');
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
