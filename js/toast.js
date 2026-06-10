/**
 * toast.js
 * Lightweight, accessible toast notifications.
 * Usage: showToast('Mensagem') or showToast('Erro!', 'error')
 */

let hideTimer = null;

export function showToast(message, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;

  clearTimeout(hideTimer);

  el.textContent = message;
  el.className = 'toast toast--visible';
  if (type === 'error') el.classList.add('toast--error');

  hideTimer = setTimeout(() => {
    el.classList.remove('toast--visible');
  }, 3000);
}
