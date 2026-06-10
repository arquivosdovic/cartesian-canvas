/**
 * persistence.js
 * Handles exporting the current project to a .json file
 * and importing it back, fully restoring state.
 */

import { state, loadState } from './store.js';

const PROJECT_VERSION = 1;

/**
 * Serialize current state and trigger a .json download.
 */
export function exportProject() {
  const project = {
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    labels: { ...state.labels },
    elements: state.elements.map(el => ({
      id: el.id,
      name: el.name,
      photo: el.photo || null,   // Base64 string or null
      scores: { ...el.scores },
    })),
  };

  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `plano-cartesiano-${formatDateForFilename(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open a file picker, read the chosen .json, validate and restore state.
 * Returns a promise that resolves when import is complete,
 * or rejects with a user-facing error message.
 */
export function importProject() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return resolve(null);   // user cancelled

      try {
        const text    = await file.text();
        const project = JSON.parse(text);
        validateProject(project);
        loadState({
          labels:     project.labels,
          elements:   project.elements,
          selectedId: null,
        });
        resolve(project);
      } catch (err) {
        reject(err.message || 'Erro ao importar o arquivo.');
      }
    });

    // Some browsers need the input in the DOM to fire the change event
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    // Clean up after a short delay (after change event fires)
    setTimeout(() => document.body.removeChild(input), 60_000);
  });
}

/**
 * Basic structural validation so bad files fail loudly.
 */
function validateProject(project) {
  if (!project || typeof project !== 'object') {
    throw new Error('Arquivo inválido: não é um objeto JSON.');
  }
  if (project.version !== PROJECT_VERSION) {
    // Allow future versions but warn — don't hard-fail
    console.warn(`[persistence] Versão do projeto ${project.version} diferente da esperada ${PROJECT_VERSION}.`);
  }
  if (!project.labels || typeof project.labels !== 'object') {
    throw new Error('Arquivo inválido: campo "labels" ausente.');
  }
  if (!Array.isArray(project.elements)) {
    throw new Error('Arquivo inválido: campo "elements" deve ser um array.');
  }
  project.elements.forEach((el, i) => {
    if (!el.id || !el.name || !el.scores) {
      throw new Error(`Elemento #${i + 1} está incompleto no arquivo.`);
    }
  });
}

function formatDateForFilename(date) {
  return date.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}
