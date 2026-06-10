/**
 * main.js
 * Entry point. Wires together store, renderer, sidebar, and persistence.
 */

import { subscribe } from './store.js';
import { init as initRenderer, requestRedraw } from './renderer.js';
import { initSidebar } from './sidebar.js';
import { exportProject, importProject } from './persistence.js';
import { showToast } from './toast.js';

// ── Theme management ──────────────────────────────────────────────────────────

function getSystemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getStoredTheme() {
  return localStorage.getItem('theme'); // 'light' | 'dark' | null
}

function applyTheme(theme) {
  // theme: 'light' | 'dark'
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
  const theme  = stored || (getSystemPrefersDark() ? 'dark' : 'light');
  applyTheme(theme);

  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next    = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
    requestRedraw();
  });

  // Follow system if no manual override
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
      requestRedraw();
    }
  });
}

// ── Capture canvas as PNG ─────────────────────────────────────────────────────

function captureCanvas(canvas) {
  const url = canvas.toDataURL('image/png');
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `plano-cartesiano-${new Date().toISOString().slice(0,16).replace('T','_').replace(':','-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const canvas  = document.getElementById('plane');
  if (!canvas) return;

  initTheme();
  initRenderer(canvas);
  initSidebar();

  subscribe(() => requestRedraw());

  const resizeObserver = new ResizeObserver(() => requestRedraw());
  resizeObserver.observe(canvas.parentElement);

  // Toolbar buttons
  document.getElementById('btnCapture')?.addEventListener('click', () => {
    captureCanvas(canvas);
    showToast('Imagem salva!');
  });

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
      if (project) showToast(`Projeto importado — ${project.elements.length} elemento(s) carregado(s).`);
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
