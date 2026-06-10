/**
 * main.js
 * Entry point.
 */

import { subscribe, selectElement, updateElementScores, state } from './store.js';
import { init as initRenderer, requestRedraw, draw, hitTestElement, canvasPosToScores } from './renderer.js';
import { initSidebar, setAxisValues } from './sidebar.js';
import { exportProject, importProject } from './persistence.js';
import { showToast } from './toast.js';

// ── Theme ─────────────────────────────────────────────────────────────────────

function getStoredTheme() { return localStorage.getItem('theme'); }

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('btnTheme');
  if (btn) {
    btn.innerHTML = theme === 'dark'
      ? '<i class="ti ti-sun" aria-hidden="true"></i>'
      : '<i class="ti ti-moon" aria-hidden="true"></i>';
    btn.title = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  }
}

function initTheme() {
  const stored = getStoredTheme();
  const theme  = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);

  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
    requestRedraw();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!getStoredTheme()) { applyTheme(e.matches ? 'dark' : 'light'); requestRedraw(); }
  });
}

// ── Capture modal ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: 'Branco',       value: '#ffffff' },
  { label: 'Creme',        value: '#f5f4f0' },
  { label: 'Cinza claro',  value: '#e8e8e8' },
  { label: 'Cinza escuro', value: '#2c2c2c' },
  { label: 'Preto',        value: '#1a1a1a' },
  { label: 'Transparente', value: null      },
  { label: 'Rosa suave',   value: '#fce4ec' },
  { label: 'Lilás',        value: '#ede7f6' },
  { label: 'Céu',          value: '#e3f2fd' },
  { label: 'Menta',        value: '#e8f5e9' },
  { label: 'Pêssego',      value: '#fff3e0' },
  { label: 'Violeta',      value: '#4a3f8f' },
  { label: 'Ardósia',      value: '#37474f' },
  { label: 'Floresta',     value: '#1b4332' },
];

function openCaptureModal(canvas) {
  document.getElementById('captureModal')?.remove();

  const dark = document.documentElement.dataset.theme === 'dark';
  let selectedBg = dark ? '#1e1e1e' : '#ffffff';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'captureModal';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Capturar imagem">
      <p class="modal__title">Capturar imagem</p>
      <p class="form-label" style="margin-bottom:8px">Cor de fundo</p>
      <div class="capture-swatches" id="captureSwatches">
        ${PRESET_COLORS.map(c => `
          <button class="swatch ${c.value === selectedBg ? 'swatch--active' : ''}"
                  data-color="${c.value ?? '__transparent__'}"
                  title="${c.label}"
                  aria-label="${c.label}">
            ${c.value === null
              ? '<span class="swatch__transparent"></span>'
              : `<span class="swatch__fill" style="background:${c.value}"></span>`}
          </button>
        `).join('')}
        <label class="swatch swatch--custom" title="Escolher cor" aria-label="Cor personalizada">
          <i class="ti ti-color-picker" style="font-size:14px;pointer-events:none"></i>
          <input type="color" id="captureCustomColor" value="${dark ? '#1e1e1e' : '#ffffff'}" style="opacity:0;position:absolute;width:0;height:0">
        </label>
      </div>
      <p class="hint" style="margin-top:6px" id="captureHint">Fundo: ${dark ? '#1e1e1e' : '#ffffff'}</p>
      <div class="modal__actions">
        <button class="btn" id="captureCancel">Cancelar</button>
        <button class="btn btn--primary" id="captureSave">
          <i class="ti ti-camera" aria-hidden="true"></i> Baixar PNG
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function setSelected(val) {
    selectedBg = val;
    overlay.querySelectorAll('.swatch').forEach(s => s.classList.remove('swatch--active'));
    const key = val === null ? '__transparent__' : val;
    overlay.querySelector(`[data-color="${key}"]`)?.classList.add('swatch--active');
    const hint = document.getElementById('captureHint');
    if (hint) hint.textContent = val === null ? 'Fundo: transparente (PNG com alpha)' : `Fundo: ${val}`;
  }

  overlay.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset.color;
      setSelected(raw === '__transparent__' ? null : raw);
    });
  });

  const customInput = document.getElementById('captureCustomColor');
  customInput.addEventListener('input', () => setSelected(customInput.value));

  overlay.querySelector('#captureCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#captureSave').addEventListener('click', () => {
    // 1. Redraw onto the live canvas with the chosen background colour
    draw(canvas, { bgColor: selectedBg });

    // 2. Export — canvas already has correct pixel dimensions
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `plano-${new Date().toISOString().slice(0,16).replace('T','_').replace(':','-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 3. Redraw without background so the canvas stays transparent in the UI
    draw(canvas);

    overlay.remove();
    showToast('Imagem salva!');
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const canvas = document.getElementById('plane');
  if (!canvas) return;

  initTheme();
  initRenderer(canvas);
  initSidebar();

  subscribe(() => requestRedraw());
  new ResizeObserver(() => requestRedraw()).observe(canvas.parentElement);

  // ── Canvas drag ─────────────────────────────────────────────────────────────
  let draggingId = null;

  function startDrag(clientX, clientY) {
    const id = hitTestElement(clientX, clientY, canvas);
    if (id == null) return false;
    draggingId = id;
    selectElement(id);
    canvas.style.cursor = 'grabbing';
    return true;
  }

  function moveDrag(clientX, clientY) {
    if (draggingId == null) return;
    const scores = canvasPosToScores(clientX, clientY, canvas);
    if (!scores) return;
    updateElementScores(draggingId, {
      right:  scores.h > 0 ? scores.h  : 0,
      left:   scores.h < 0 ? -scores.h : 0,
      top:    scores.v > 0 ? scores.v  : 0,
      bottom: scores.v < 0 ? -scores.v : 0,
    });
    setAxisValues(scores.h, scores.v);
  }

  function endDrag() {
    draggingId = null;
    canvas.style.cursor = '';
  }

  canvas.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { moveDrag(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   endDrag);

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (startDrag(t.clientX, t.clientY)) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (draggingId == null || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', endDrag);

  // Change cursor on hover over elements
  canvas.addEventListener('mousemove', e => {
    if (draggingId != null) return;
    const id = hitTestElement(e.clientX, e.clientY, canvas);
    canvas.style.cursor = id != null ? 'grab' : '';
  });

  document.getElementById('btnCapture')?.addEventListener('click', () => openCaptureModal(canvas));

  document.getElementById('btnExport')?.addEventListener('click', () => {
    try {
      exportProject();
      showToast('Projeto exportado com sucesso!');
    } catch (err) {
      showToast('Erro ao exportar: ' + err.message, 'error');
    }
  });

  document.getElementById('btnImport')?.addEventListener('click', async () => {
    try {
      const project = await importProject();
      if (project) showToast(`Importado — ${project.elements.length} elemento(s).`);
    } catch (err) {
      showToast(err, 'error');
    }
  });

  requestRedraw();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
