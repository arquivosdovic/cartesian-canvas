/**
 * sidebar.js
 * Manages all sidebar interactions: labels, add-element form,
 * element list rendering, and score panel.
 */

import {
  state,
  subscribe,
  setLabel,
  addElement,
  removeElement,
  updateElementScores,
  selectElement,
  getSelected,
} from './store.js';

let pendingPhotoDataUrl = null;

export function initSidebar() {
  bindLabelInputs();
  bindAddForm();
  bindScoreInputs();
  subscribe(onStateChange);
}

// ── Label inputs ─────────────────────────────────────────────────────────────

function bindLabelInputs() {
  const ids = ['lTop', 'lBottom', 'lLeft', 'lRight'];
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
    if (!name) {
      nameInput?.focus();
      return;
    }

    addElement({
      id: Date.now(),
      name,
      photo: pendingPhotoDataUrl,
      scores: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    // Reset form
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
    // Only update if the value actually changed to avoid stealing focus mid-typing
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
         aria-label="Selecionar ${el.name}">
      ${el.photo
        ? `<img class="elem-item__avatar" src="${el.photo}" alt="${el.name}">`
        : `<div class="elem-item__initials" aria-hidden="true">${initials(el.name)}</div>`
      }
      <span class="elem-item__name">${escapeHtml(el.name)}</span>
      <button class="btn btn--icon btn--danger"
              data-remove="${el.id}"
              aria-label="Remover ${el.name}"
              title="Remover">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.elem-item').forEach(item => {
    const id = Number(item.dataset.id);
    item.addEventListener('click', e => {
      if (e.target.closest('[data-remove]')) return;
      selectElement(id);
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectElement(id);
    });
  });

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeElement(Number(btn.dataset.remove));
    });
  });
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
