/**
 * dailyNotes.js — Notas de sesión y día (v4.4)
 *
 * Permite registrar:
 * - El contexto del mercado antes de operar
 * - Notas post-sesión (qué salió bien/mal)
 * - Estado de ánimo del día
 * - Notas libres por día o sesión
 */
import { showToast } from '../utils/helpers.js';

const SESSIONS  = ['', 'Asia', 'Londres', 'Nueva York', 'Overlap NY-LON'];
const MOODS     = ['', '😊 Excelente', '🙂 Bien', '😐 Neutro', '😔 Bajo', '😤 Estresado'];

// ── SETUP ──────────────────────────────────────────────────────────────────
export function setupDailyNotes(j) {
  document.getElementById('saveDailyNoteBtn')?.addEventListener('click',  () => saveDailyNoteFromForm(j));
  document.getElementById('cancelDailyNoteBtn')?.addEventListener('click', () => resetDailyNoteForm(j));
  document.getElementById('addDailyNoteBtn')?.addEventListener('click', () => {
    // Pre-fill fecha con hoy
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('dnDate');
    if (dateEl && !dateEl.value) dateEl.value = today;
    document.getElementById('dnDate')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('dnContent')?.focus();
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────────
export function renderDailyNotes(j) {
  const list = document.getElementById('dailyNotesList');
  if (!list) return;

  // Agrupar por fecha
  const byDate = {};
  (j.dailyNotes || []).forEach(n => {
    if (!byDate[n.date]) byDate[n.date] = [];
    byDate[n.date].push(n);
  });

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (!dates.length) {
    list.innerHTML = `<div class="text-center py-12 text-slate-500">
      <i class="fas fa-book-open text-4xl mb-3 block opacity-30"></i>
      <p class="text-sm">Sin notas todavía.</p>
      <p class="text-xs mt-1 text-slate-600">Registra el contexto del mercado antes de operar.</p>
    </div>`;
    return;
  }

  list.innerHTML = dates.map(date => {
    const notes     = byDate[date];
    const formatted = formatDate(date);
    const trades    = (j.trades || []).filter(t => t.date === date);
    const wins  = trades.filter(t => t.result === 'WIN').length;
    const total = trades.filter(t => t.result !== 'OPEN').length;
    const tradesBadge = total
      ? `<span class="text-xs px-2 py-0.5 rounded" style="background:rgba(59,130,246,0.15);color:#93c5fd">${wins}/${total} trades</span>`
      : '';

    return `<div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold text-blue-400">${formatted}</span>
        ${tradesBadge}
      </div>
      ${notes.map(n => renderNoteCard(n)).join('')}
    </div>`;
  }).join('');
}

function renderNoteCard(n) {
  const sessionBadge = n.session
    ? `<span class="text-xs px-2 py-0.5 rounded" style="background:rgba(124,58,237,0.2);color:#c4b5fd">${n.session}</span>`
    : '';
  const moodBadge = n.mood
    ? `<span class="text-xs">${n.mood}</span>`
    : '';
  return `<div class="glass-effect p-3 mb-2 relative">
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="flex items-center gap-2 flex-wrap">
        ${sessionBadge}
        ${moodBadge}
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button onclick="window.journal.editDailyNote('${n.id}')" class="text-slate-400 hover:text-blue-400 p-1"><i class="fas fa-edit text-xs"></i></button>
        <button onclick="window.journal.deleteDailyNote('${n.id}')" class="text-slate-400 hover:text-red-400 p-1"><i class="fas fa-trash text-xs"></i></button>
      </div>
    </div>
    <p class="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">${escHtml(n.content)}</p>
  </div>`;
}

// ── FORM SAVE ─────────────────────────────────────────────────────────────
async function saveDailyNoteFromForm(j) {
  const btn     = document.getElementById('saveDailyNoteBtn');
  const dateVal = document.getElementById('dnDate')?.value;
  const content = document.getElementById('dnContent')?.value.trim();

  if (!dateVal) { showToast('Selecciona la fecha', 'error'); return; }
  if (!content) { showToast('Escribe algo en la nota', 'error'); return; }

  const session = document.getElementById('dnSession')?.value || '';
  const mood    = document.getElementById('dnMood')?.value    || '';
  const editId  = document.getElementById('dnEditId')?.value  || '';

  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const note = { date: dateVal, session, mood, content };
    if (editId) note.id = editId;
    const saved = await j.saveDailyNote(note);
    if (saved) {
      resetDailyNoteForm(j);
      renderDailyNotes(j);
      showToast('Nota guardada ✓');
    }
  } catch (err) {
    showToast('Error al guardar', 'error');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar nota'; }
  }
}

export function editDailyNote(j, id) {
  const note = (j.dailyNotes || []).find(n => n.id === id);
  if (!note) return;
  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  setVal('dnDate',    note.date);
  setVal('dnSession', note.session);
  setVal('dnMood',    note.mood);
  setVal('dnContent', note.content);
  setVal('dnEditId',  note.id);
  const btn = document.getElementById('saveDailyNoteBtn');
  if (btn) btn.textContent = 'Actualizar nota';
  document.getElementById('dnContent')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('dnContent')?.focus();
}

function resetDailyNoteForm(j) {
  ['dnDate','dnSession','dnMood','dnContent','dnEditId'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const btn = document.getElementById('saveDailyNoteBtn');
  if (btn) btn.textContent = 'Guardar nota';
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
