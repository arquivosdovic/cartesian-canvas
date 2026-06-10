/**
 * store.js
 * Central state for elements and axis labels.
 * Uses a simple observer pattern so modules can react to changes.
 */

const listeners = [];

export const state = {
  labels: {
    top: 'Alto',
    bottom: 'Baixo',
    left: 'Esquerda',
    right: 'Direita',
  },
  elements: [],
  selectedId: null,
};

export function subscribe(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach(fn => fn(state));
}

export function setLabel(direction, value) {
  state.labels[direction] = value;
  notify();
}

export function addElement(element) {
  state.elements.push(element);
  state.selectedId = element.id;
  notify();
}

export function removeElement(id) {
  state.elements = state.elements.filter(e => e.id !== id);
  if (state.selectedId === id) {
    state.selectedId = state.elements.length ? state.elements[state.elements.length - 1].id : null;
  }
  notify();
}

export function updateElementScores(id, scores) {
  const el = state.elements.find(e => e.id === id);
  if (el) {
    el.scores = { ...el.scores, ...scores };
    notify();
  }
}

export function selectElement(id) {
  state.selectedId = id;
  notify();
}

export function getSelected() {
  return state.elements.find(e => e.id === state.selectedId) || null;
}

/**
 * Replace entire state at once (used by import).
 */
export function loadState({ labels, elements, selectedId }) {
  state.labels     = { ...labels };
  state.elements   = elements.map(el => ({ ...el, scores: { ...el.scores } }));
  state.selectedId = selectedId ?? null;
  notify();
}
