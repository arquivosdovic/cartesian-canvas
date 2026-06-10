/**
 * main.js
 * Entry point. Wires together store, renderer, sidebar, and persistence.
 */

import { subscribe } from './store.js';
import { init as initRenderer, requestRedraw } from './renderer.js';
import { initSidebar } from './sidebar.js';
import { exportProject, importProject } from './persistence.js';
import { showToast } from './toast.js';

function main() {
  const canvas = document.getElementById('plane');
  if (!canvas) return;

  const wrapper = canvas.parentElement;
  canvas.style.width  = '100%';
  canvas.style.height = wrapper.clientWidth + 'px';

  initRenderer(canvas);
  initSidebar();

  // Re-draw on state changes
  subscribe(() => requestRedraw());

  // Re-draw on resize
  const resizeObserver = new ResizeObserver(() => {
    canvas.style.height = wrapper.clientWidth + 'px';
    requestRedraw();
  });
  resizeObserver.observe(wrapper);

  // ── Toolbar buttons ────────────────────────────────────────────────────────

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

  // Initial draw
  requestRedraw();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
