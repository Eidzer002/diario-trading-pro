/**
 * helpers.js — Utilidades de UI
 * Funciones puras sin dependencias del estado de la app.
 */

export function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

let _toastTimer = null;
export function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  if (_toastTimer) clearTimeout(_toastTimer);
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.add('show');
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

export function generateId() {
  return Date.now().toString();
}
