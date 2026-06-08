/**
 * db.js — Capa de persistencia
 * Actualmente usa localStorage.
 * En el futuro se puede reemplazar por Supabase
 * sin tocar ningún otro módulo.
 */
export const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  },
  save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
