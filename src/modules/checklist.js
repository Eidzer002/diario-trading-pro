/**
 * checklist.js — Pre-trade checklist configurable (v4.4)
 *
 * Flujo:
 * 1. El usuario hace clic en "Guardar" en el form de trade.
 * 2. Si hay ítems de checklist configurados, se abre el modal de checklist.
 * 3. El usuario marca/desmarca ítems y confirma.
 * 4. El resultado se guarda en trade.checklist = [{item, checked}].
 * 5. El score del checklist aparece en la tarjeta del trade.
 */
import { saveConfig } from '../db.js';
import { showToast }  from '../utils/helpers.js';

// Callback que se llama cuando el usuario confirma el checklist
let _onConfirm = null;

// ── SETUP ──────────────────────────────────────────────────────────────────
export function setupChecklist(j) {
  // Confirmar checklist → llamar callback
  document.getElementById('checklistConfirmBtn')?.addEventListener('click', () => {
    if (!_onConfirm) return;
    const items = [];
    document.querySelectorAll('#checklistModalItems .checklist-row').forEach(row => {
      const cb   = row.querySelector('input[type="checkbox"]');
      const text = row.querySelector('.checklist-label')?.textContent || '';
      items.push({ item: text, checked: cb?.checked || false });
    });
    closeChecklistModal();
    _onConfirm(items);
    _onConfirm = null;
  });

  // Cancelar checklist → confirmar con todos desmarcados (guardar igual)
  document.getElementById('checklistSkipBtn')?.addEventListener('click', () => {
    if (!_onConfirm) return;
    closeChecklistModal();
    _onConfirm([]);
    _onConfirm = null;
  });

  document.getElementById('checklistModalClose')?.addEventListener('click', () => {
    closeChecklistModal();
    _onConfirm = null;
  });
}

// ── OPEN / CLOSE MODAL ────────────────────────────────────────────────────
export function openChecklistModal(j, onConfirm) {
  _onConfirm = onConfirm;
  const items    = j.config.checklistItems || [];
  const container = document.getElementById('checklistModalItems');
  if (!container) { onConfirm([]); return; }

  if (!items.length) { onConfirm([]); return; } // Sin checklist configurado → guardar directo

  container.innerHTML = items.map((item, i) => `
    <label class="checklist-row flex items-start gap-3 p-3 rounded-lg cursor-pointer"
           style="background:rgba(30,41,59,0.6);border:1px solid rgba(255,255,255,0.06)">
      <input type="checkbox" id="cl_${i}" class="mt-0.5 w-4 h-4 accent-blue-500 flex-shrink-0">
      <span class="checklist-label text-sm text-slate-200">${item}</span>
    </label>
  `).join('');

  const modal = document.getElementById('checklistModal');
  if (modal) modal.style.display = 'flex';
}

function closeChecklistModal() {
  const modal = document.getElementById('checklistModal');
  if (modal) modal.style.display = 'none';
}

// ── CONFIG RENDER ─────────────────────────────────────────────────────────
export function renderChecklistConfig(j) {
  const container = document.getElementById('checklistItemsContainer');
  if (!container) return;
  const items = j.config.checklistItems || [];
  container.innerHTML = !items.length
    ? '<p class="text-xs text-slate-500 italic">Sin ítems. Añade condiciones de entrada.</p>'
    : items.map((item, i) =>
        `<div class="flex items-center gap-2 p-2 rounded" style="background:rgba(30,41,59,0.6)">
          <span class="text-xs text-slate-300 flex-1">${item}</span>
          <button onclick="window.journal.removeChecklistItem(${i})"
                  class="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
        </div>`
      ).join('');
}

// Exponer en la clase journal vía window
export function setupChecklistConfig(j) {
  document.getElementById('addChecklistItemBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('newChecklistItemInput');
    const val   = input?.value.trim();
    if (!val) return;
    j.config.checklistItems = j.config.checklistItems || [];
    j.config.checklistItems.push(val);
    await saveConfig(j.config, j.userId);
    input.value = '';
    renderChecklistConfig(j);
    showToast('Ítem añadido ✓');
  });
  document.getElementById('newChecklistItemInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addChecklistItemBtn')?.click(); }
  });
}
