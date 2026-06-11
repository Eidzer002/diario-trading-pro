/**
 * tradeForm.js — Formulario de operaciones, filtros, tags y lista de trades
 */
import { showToast, openModal, closeModal } from '../utils/helpers.js';
import { calcPL } from '../utils/calculations.js';
import { saveTrade } from '../db.js';
import { openChecklistModal } from './checklist.js';

// ── SETUP ──────────────────────────────────────────────────────────────────

export function setupTradeForm(j) {
  document.getElementById('addTradeBtn')?.addEventListener('click', () => openTradeModal(j));
  document.getElementById('tradeForm')?.addEventListener('submit', async e => { e.preventDefault(); await saveTradeFromForm(j); });
  document.getElementById('tradeResult')?.addEventListener('change', e => {
    document.getElementById('lossCauseSection')?.classList.toggle('show', e.target.value === 'LOSS');
  });
  document.getElementById('tradeRulesFollowed')?.addEventListener('change', e => {
    document.getElementById('rulesBreakSection')?.classList.toggle('show', e.target.value !== 'Sí');
  });

  // Riesgo en dólares
  const calcRisk = () => {
    const acc  = j.getAccountById(document.getElementById('tradeAccount')?.value);
    const val  = parseFloat(document.getElementById('riskValue')?.value) || 0;
    const type = document.getElementById('riskType')?.value;
    const disp = document.getElementById('riskCalcDisplay');
    const span = document.getElementById('riskInDollars');
    if (acc && val > 0 && span) {
      const bal = j.getAccountBalance(acc.id);
      const amt = type === 'percentage' ? (bal * val / 100) : val;
      span.textContent = '$' + amt.toFixed(2);
      disp?.classList.remove('hidden');
    } else { disp?.classList.add('hidden'); }
  };
  document.getElementById('riskValue')?.addEventListener('input', calcRisk);
  document.getElementById('riskType')?.addEventListener('change', calcRisk);
  document.getElementById('tradeAccount')?.addEventListener('change', () => {
    calcRisk();
    const acc = j.getAccountById(document.getElementById('tradeAccount').value);
    if (acc) { const ci = document.getElementById('calcCapital'); if (ci) ci.value = j.getAccountBalance(acc.id).toFixed(2); }
  });

  // Auto R:R desde precios
  const calcAutoRR = () => {
    const entry = parseFloat(document.getElementById('tradeEntryPrice')?.value) || 0;
    const sl    = parseFloat(document.getElementById('tradeSLPrice')?.value) || 0;
    const tp    = parseFloat(document.getElementById('tradeTPPrice')?.value) || 0;
    const rrDispEl   = document.getElementById('priceRRDisplay');
    const distDispEl = document.getElementById('priceSLDistDisplay');
    const rrValEl    = document.getElementById('priceRRValue');
    if (entry > 0 && sl > 0 && Math.abs(entry - sl) > 0) {
      const distSL = Math.abs(entry - sl);
      const dec = entry < 10 ? 5 : 2;
      const slDistEl = document.getElementById('priceSLDist'); if (slDistEl) slDistEl.textContent = distSL.toFixed(dec);
      if (tp > 0) {
        const distTP = Math.abs(tp - entry);
        const tpDistEl = document.getElementById('priceTPDist'); if (tpDistEl) tpDistEl.textContent = distTP.toFixed(dec);
        distDispEl?.classList.remove('hidden');
        const rr = (distTP / distSL).toFixed(2); const rrNum = parseFloat(rr);
        const rrPlEl = document.getElementById('tradeRRPlanned'); if (rrPlEl) rrPlEl.value = rr;
        rrDispEl?.classList.remove('hidden');
        if (rrValEl) { rrValEl.textContent = '1:' + rr; rrValEl.style.color = rrNum >= 2 ? '#4ade80' : rrNum >= 1 ? '#fb923c' : '#f87171'; }
      } else {
        distDispEl?.classList.remove('hidden');
        const tpDistEl = document.getElementById('priceTPDist'); if (tpDistEl) tpDistEl.textContent = '-';
        rrDispEl?.classList.add('hidden');
      }
    } else { rrDispEl?.classList.add('hidden'); distDispEl?.classList.add('hidden'); }
  };

  const calcAutoRRReal = () => {
    const entry  = parseFloat(document.getElementById('tradeEntryPrice')?.value) || 0;
    const sl     = parseFloat(document.getElementById('tradeSLPrice')?.value) || 0;
    const close  = parseFloat(document.getElementById('tradeClosePrice')?.value) || 0;
    const dir    = document.getElementById('tradeDirection')?.value || '';
    const dispEl = document.getElementById('rrRealAutoDisplay');
    const valEl  = document.getElementById('rrRealAutoValue');
    if (entry > 0 && sl > 0 && close > 0) {
      const distSL = Math.abs(entry - sl);
      if (distSL > 0) {
        const signedDist = dir === 'SHORT' ? (entry - close) : (close - entry);
        const rrReal = (signedDist / distSL).toFixed(2); const rrRealNum = parseFloat(rrReal);
        const rrRealEl = document.getElementById('tradeRRReal'); if (rrRealEl) rrRealEl.value = Math.abs(rrRealNum).toFixed(2);
        dispEl?.classList.remove('hidden');
        if (valEl) { valEl.textContent = (rrRealNum >= 0 ? '+' : '') + rrReal + 'R'; valEl.style.color = rrRealNum >= 0 ? '#4ade80' : '#f87171'; }
      }
    } else { dispEl?.classList.add('hidden'); }
  };

  const calcDuration = () => {
    const date = document.getElementById('tradeDate')?.value, time = document.getElementById('tradeTime')?.value;
    const cDate = document.getElementById('tradeCloseDate')?.value, cTime = document.getElementById('tradeCloseTime')?.value;
    const dispEl = document.getElementById('durationDisplay'), valEl = document.getElementById('durationValue');
    if (date && time && cDate && cTime) {
      const diff = new Date(`${cDate}T${cTime}`) - new Date(`${date}T${time}`);
      if (diff > 0 && valEl && dispEl) {
        const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
        valEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
        dispEl.classList.remove('hidden');
      }
    } else { dispEl?.classList.add('hidden'); }
  };

  ['tradeEntryPrice', 'tradeSLPrice', 'tradeTPPrice', 'tradeDirection'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcAutoRR);
    document.getElementById(id)?.addEventListener('change', calcAutoRR);
  });
  document.getElementById('tradeClosePrice')?.addEventListener('input', () => { calcAutoRRReal(); });
  document.getElementById('tradeDirection')?.addEventListener('change', () => { calcAutoRRReal(); });
  ['tradeCloseDate', 'tradeCloseTime', 'tradeDate', 'tradeTime'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', calcDuration);
  });
}

export function setupLotCalculator(j) {
  document.getElementById('calcLotBtn')?.addEventListener('click', () => {
    const entry = parseFloat(document.getElementById('tradeEntryPrice')?.value) || 0;
    const sl    = parseFloat(document.getElementById('tradeSLPrice')?.value) || 0;
    const pipV  = parseFloat(document.getElementById('calcPipVal')?.value) || 1;
    const accId = document.getElementById('tradeAccount')?.value;
    const acc   = j.getAccountById(accId);
    const capital   = parseFloat(document.getElementById('calcCapital')?.value) || (acc ? j.getAccountBalance(acc.id) : 10000);
    const riskPct   = parseFloat(document.getElementById('riskValue')?.value) || 1;
    const riskType  = document.getElementById('riskType')?.value || 'percentage';
    if (!entry || !sl) { showToast('Ingresa Entrada y SL en la sección Precios ↑', 'error'); return; }
    const dist = Math.abs(entry - sl);
    if (dist === 0) { showToast('Entrada y SL no pueden ser iguales', 'error'); return; }
    const riskAmt = riskType === 'percentage' ? (capital * riskPct / 100) : riskPct;
    const lotSize = (riskAmt / (dist * pipV)).toFixed(2);
    const rrP = parseFloat(document.getElementById('tradeRRPlanned')?.value) || 2;
    const dir = document.getElementById('tradeDirection')?.value;
    const tpPrice = dir === 'SHORT' ? (entry - dist * rrP) : (entry + dist * rrP);
    const res = document.getElementById('lotCalcResult'); res?.classList.remove('hidden');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('lotResultValue', lotSize + ' lotes');
    set('lotResultDetail', `Dist SL: ${dist.toFixed(2)} pts · PipVal: $${pipV}`);
    set('lotRiskDollar', '$' + riskAmt.toFixed(2));
    set('lotDistSL', dist.toFixed(2) + ' pts');
    set('lotTPEst', tpPrice.toFixed(2));
    const tp = document.getElementById('tradeTPPrice'); if (tp && !tp.value) { tp.value = tpPrice.toFixed(2); tp.dispatchEvent(new Event('input')); }
  });
}

// ── MODAL ──────────────────────────────────────────────────────────────────

export function openTradeModal(j, tradeId = null) {
  if (!j.accounts.length) { showToast('Crea una cuenta primero', 'error'); openModal('setupModal'); return; }
  j.editTradeId = tradeId;
  j.populateAccountSelector();
  j.populateTradeSelects();
  populateTagSuggestions(j);
  document.getElementById('lossCauseSection')?.classList.remove('show');
  document.getElementById('rulesBreakSection')?.classList.remove('show');
  if (tradeId) {
    const t = j.trades.find(x => x.id === tradeId);
    if (t) fillTradeForm(j, t);
    const ti = document.getElementById('modalTradeTitle'); if (ti) ti.textContent = 'Editar Operación';
  } else {
    document.getElementById('tradeForm')?.reset();
    j._formTags = []; renderFormTags(j);
    const now = new Date();
    const td = document.getElementById('tradeDate'); if (td) td.value = now.toISOString().split('T')[0];
    const tt = document.getElementById('tradeTime'); if (tt) tt.value = now.toTimeString().slice(0, 5);
    const ta = document.getElementById('tradeAccount'); if (ta && j.activeAccount) ta.value = j.activeAccount;
    const rf = document.getElementById('tradeRulesFollowed'); if (rf) rf.value = 'Sí';
    const ms = document.getElementById('tradeMentalState'); if (ms) ms.value = 'Neutro';
    const ti = document.getElementById('modalTradeTitle'); if (ti) ti.textContent = 'Nueva Operación';
  }
  openModal('addTradeModal');
}

export function closeTradeModal(j) {
  closeModal('addTradeModal'); j.editTradeId = null;
}

export function fillTradeForm(j, t) {
  const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  f('tradeAccount', t.accountId); f('tradeDate', t.date); f('tradeTime', t.time);
  f('tradePair', t.pair); f('tradeDirection', t.direction); f('tradeTimeframe', t.timeframe);
  f('tradeHTFTimeframe', t.htfTimeframe); f('tradeSession', t.session); f('tradeStrategy', t.strategy); f('tradePOI', t.poi);
  f('tradeFibLevel', t.fibLevel); f('tradeTrendHTF', t.trendHTF); f('tradeAligned', t.aligned);
  f('confluenceDetails', t.confluenceDetails);
  f('tradeEntryPrice', t.entryPrice); f('tradeSLPrice', t.slPrice); f('tradeTPPrice', t.tpPrice); f('tradeClosePrice', t.closePrice);
  f('riskType', t.riskType || 'percentage'); f('riskValue', t.riskValue);
  f('tradeMentalState', t.mentalState || 'Neutro'); f('tradeRulesFollowed', t.rulesFollowed || 'Sí');
  f('tradeRulesBreak', t.rulesBreak); f('tradeRRPlanned', t.rrPlanned);
  f('tradeResult', t.result); f('tradeRRReal', t.rrReal); f('tradeLossCause', t.lossCause);
  f('tradeCloseDate', t.closeDate); f('tradeCloseTime', t.closeTime); f('tradeNotes', t.notes);
  const ig = document.getElementById('tradeIgnoredNews'); if (ig) ig.checked = t.ignoredNews || false;
  j._formTags = [...(t.tags || [])]; renderFormTags(j);
  if (t.result === 'LOSS') document.getElementById('lossCauseSection')?.classList.add('show');
  if (t.rulesFollowed && t.rulesFollowed !== 'Sí') document.getElementById('rulesBreakSection')?.classList.add('show');
}

export async function saveTradeFromForm(j) {
  const g = id => document.getElementById(id)?.value || '';
  const accountId = g('tradeAccount');
  if (!accountId) { showToast('Selecciona una cuenta', 'error'); return; }
  const data = {
    accountId, date: g('tradeDate'), time: g('tradeTime'),
    pair: g('tradePair').toUpperCase(), direction: g('tradeDirection'),
    timeframe: g('tradeTimeframe'), htfTimeframe: g('tradeHTFTimeframe') || null,
    session: g('tradeSession'),
    strategy: g('tradeStrategy'), poi: g('tradePOI'), fibLevel: g('tradeFibLevel'),
    trendHTF: g('tradeTrendHTF'), aligned: g('tradeAligned'),
    confluenceDetails: g('confluenceDetails'),
    entryPrice: parseFloat(g('tradeEntryPrice')) || null,
    slPrice:    parseFloat(g('tradeSLPrice'))    || null,
    tpPrice:    parseFloat(g('tradeTPPrice'))    || null,
    closePrice: parseFloat(g('tradeClosePrice')) || null,
    riskType: g('riskType') || 'percentage', riskValue: parseFloat(g('riskValue')) || 0,
    mentalState: g('tradeMentalState') || 'Neutro',
    rulesFollowed: g('tradeRulesFollowed') || 'Sí',
    rulesBreak: g('tradeRulesBreak'),
    rrPlanned: parseFloat(g('tradeRRPlanned')) || 0,
    result: g('tradeResult'), rrReal: parseFloat(g('tradeRRReal')) || 0,
    lossCause: g('tradeLossCause'),
    ignoredNews: document.getElementById('tradeIgnoredNews')?.checked || false,
    closeDate: g('tradeCloseDate'), closeTime: g('tradeCloseTime'), notes: g('tradeNotes'),
    tags: [...(j._formTags || [])],
    duration: (() => { const d = g('tradeDate'), ti = g('tradeTime'), cd = g('tradeCloseDate'), ct = g('tradeCloseTime'); if (d && ti && cd && ct) { const diff = new Date(`${cd}T${ct}`) - new Date(`${d}T${ti}`); if (diff > 0) return Math.round(diff / 60000); } return null; })(),
    updatedAt: new Date().toISOString(),
  };
  if (!data.date) { showToast('La fecha es requerida', 'error'); return; }
  if (!data.pair)  { showToast('El activo es requerido', 'error'); return; }

  // Si hay checklist configurado y es una operación nueva, mostrar el checklist
  const checklistItems = j.config.checklistItems || [];
  if (checklistItems.length > 0 && !j.editTradeId) {
    openChecklistModal(j, async (checklist) => {
      data.checklist = checklist;
      await _doSaveTrade(j, data);
    });
    return;
  }

  data.checklist = [];
  await _doSaveTrade(j, data);
}

async function _doSaveTrade(j, data) {
  const btn = document.getElementById('saveTradeBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (j.editTradeId) {
      data.id = j.editTradeId;
      const saved = await saveTrade(data, j.userId);
      if (saved) { const idx = j.trades.findIndex(t => t.id === j.editTradeId); if (idx !== -1) j.trades[idx] = saved; }
      showToast('Operación actualizada');
    } else {
      const saved = await saveTrade(data, j.userId);
      if (saved) j.trades.unshift(saved);

      // Feedback del checklist
      if (data.checklist && data.checklist.length > 0) {
        const checked = data.checklist.filter(c => c.checked).length;
        const total   = data.checklist.length;
        const score   = Math.round(checked / total * 100);
        const color   = score === 100 ? '✅' : score >= 70 ? '⚠️' : '🔴';
        showToast(`${color} Checklist: ${checked}/${total} (${score}%)`);
      } else {
        showToast('Operación guardada ✓');
      }
    }
    j.filteredTrades = [...j.trades];
    closeTradeModal(j);
    j.renderDashboard();
    j.renderTrades();
  } catch (err) {
    showToast('Error al guardar', 'error');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  }
}

export function deleteTrade(j, id) {
  if (!confirm('¿Eliminar esta operación?')) return;
  j.trades = j.trades.filter(t => t.id !== id);
  j.filteredTrades = j.filteredTrades.filter(t => t.id !== id);
  DB.save('tj_trades', j.trades);
  j.renderTrades(); j.renderDashboard();
  showToast('Eliminada', 'info');
}

// ── FILTERS ────────────────────────────────────────────────────────────────

export function applyFilters(j) {
  const g = id => document.getElementById(id)?.value || '';
  const aF = g('filterAccount'), pF = g('filterPair'), rF = g('filterResult'),
        mF = g('filterMentalState'), frF = g('filterFromDate'), toF = g('filterToDate'),
        tagF = g('filterTag').toLowerCase().trim();
  j.filteredTrades = j.trades.filter(t => {
    if (aF  && t.accountId   !== aF)  return false;
    if (pF  && t.pair        !== pF)  return false;
    if (rF  && t.result      !== rF)  return false;
    if (mF  && t.mentalState !== mF)  return false;
    if (frF && t.date < frF)          return false;
    if (toF && t.date > toF)          return false;
    if (tagF && !(t.tags || []).some(tag => tag.toLowerCase().includes(tagF))) return false;
    return true;
  });
  j.renderTrades();
  showToast(`${j.filteredTrades.length} operaciones`, 'info');
}

export function clearFilters(j) {
  ['filterAccount','filterPair','filterResult','filterMentalState','filterFromDate','filterToDate','filterTag'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  j.filteredTrades = [...j.trades]; j.renderTrades();
}

export function populatePairFilter(j) {
  const fPair = document.getElementById('filterPair'); if (!fPair) return;
  const pairs = [...new Set(j.trades.map(t => t.pair).filter(Boolean))].sort();
  fPair.innerHTML = '<option value="">Todos</option>' + pairs.map(p => `<option value="${p}">${p}</option>`).join('');
}

// ── TAGS ───────────────────────────────────────────────────────────────────

export function setupTagInput(j) {
  j._formTags = j._formTags || [];
  const addTag = () => {
    const inp = document.getElementById('tagInput'); if (!inp) return;
    const raw = inp.value.trim().toLowerCase().replace(/,/g, '');
    if (!raw || j._formTags.includes(raw)) { inp.value = ''; return; }
    j._formTags.push(raw); inp.value = ''; renderFormTags(j);
  };
  document.getElementById('tagInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } });
  document.getElementById('addTagBtn')?.addEventListener('click', addTag);
}

export function renderFormTags(j) {
  const c = document.getElementById('tagsContainer'); if (!c) return;
  c.innerHTML = (j._formTags || []).map((tag, i) =>
    `<span class="tag-pill">${tag}<span class="tag-remove" data-i="${i}">✕</span></span>`
  ).join('');
  c.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => { j._formTags.splice(parseInt(btn.dataset.i), 1); renderFormTags(j); });
  });
}

export function populateTagSuggestions(j) {
  const allTags = [...new Set(j.trades.flatMap(t => t.tags || []))].sort();
  const dl  = document.getElementById('tagSuggestions');  if (dl)  dl.innerHTML  = allTags.map(t => `<option value="${t}">`).join('');
  const fdl = document.getElementById('filterTagList');   if (fdl) fdl.innerHTML = allTags.map(t => `<option value="${t}">`).join('');
}

// ── RENDER TRADES ──────────────────────────────────────────────────────────

export function renderTrades(j) {
  j.populateAccountSelector();
  populatePairFilter(j);
  const list = document.getElementById('tradesList'); if (!list) return;
  if (!j.filteredTrades.length) {
    list.innerHTML = `<div class="text-center py-12 text-slate-500"><i class="fas fa-inbox text-4xl mb-3 block"></i><p>Sin operaciones. ¡Registra la primera!</p></div>`; return;
  }
  list.innerHTML = j.filteredTrades.map(t => {
    const acc = j.getAccountById(t.accountId);
    const pl  = acc ? calcPL(t, acc.initialCapital) : 0;
    const isWin  = t.result === 'WIN';
    const isLoss = t.result === 'LOSS';
    const borderClass = isWin ? 'trade-card-win' : isLoss ? 'trade-card-loss' : t.result === 'OPEN' ? 'trade-card-open' : 'trade-card-be';
    const resClass    = isWin ? 'result-win'     : isLoss ? 'result-loss'     : 'result-be';
    const plClass     = isWin ? 'phosphor-win'   : isLoss ? 'phosphor-loss'   : '';
    const dirClass    = (t.direction === 'LONG' || t.direction === 'BUY') ? 'dir-long' : 'dir-short';
    const plStr = t.result !== 'OPEN'
      ? `${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`
      : '<span style="color:var(--accent-blue)">OPEN</span>';

    return `
    <div class="glass-effect ${borderClass} p-3 mb-2">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span style="font-family:var(--font-ui);font-size:15px;font-weight:700;color:var(--text-primary)">${t.pair || '-'}</span>
          <span class="${dirClass}">${t.direction || '-'}</span>
          <span class="${resClass}">${t.result || '-'}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-data font-bold text-sm ${plClass}">${plStr}</span>
          <button onclick="window.journal.openTradeModal('${t.id}')" style="color:var(--text-muted);padding:4px" class="hover:text-blue-400"><i class="fas fa-edit text-xs"></i></button>
          <button onclick="window.journal.deleteTrade('${t.id}')" style="color:var(--text-muted);padding:4px" class="hover:text-red-400"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </div>
      <!-- Meta row -->
      <div class="flex items-center gap-2 flex-wrap mb-2" style="font-family:var(--font-data);font-size:11px;color:var(--text-muted)">
        <span><i class="fas fa-calendar-alt mr-1"></i>${t.date || ''} ${t.time ? t.time.substring(0,5) : ''}</span>
        ${t.htfTimeframe
          ? `<span style="color:var(--text-secondary)">${t.htfTimeframe}<i class="fas fa-long-arrow-alt-right mx-1" style="font-size:9px;color:var(--text-muted)"></i>${t.timeframe || ''}</span>`
          : t.timeframe ? `<span>${t.timeframe}</span>` : ''}
        ${t.session ? `<span style="background:rgba(124,58,237,0.15);color:#c4b5fd;border:1px solid rgba(124,58,237,0.25);border-radius:4px;padding:1px 7px">${t.session}</span>` : ''}
        ${acc ? `<span class="account-badge" style="background:${acc.color}20;color:${acc.color};border:1px solid ${acc.color}40">${acc.name}</span>` : ''}
      </div>
      <!-- Stats grid -->
      <div class="grid grid-cols-3 gap-x-3 gap-y-1 mb-2" style="font-size:11px">
        <div><span style="color:var(--text-muted)">Setup </span><span style="color:var(--text-secondary);font-family:var(--font-data)">${t.poi || '-'}</span></div>
        <div><span style="color:var(--text-muted)">Fib </span><span style="color:var(--text-secondary);font-family:var(--font-data)">${t.fibLevel ? t.fibLevel + '%' : '-'}</span></div>
        <div><span style="color:var(--text-muted)">R:R </span><span style="font-family:var(--font-data);color:var(--text-primary)">1:${t.rrPlanned || '-'}→${t.rrReal || '-'}</span></div>
        <div><span style="color:var(--text-muted)">Riesgo </span><span style="font-family:var(--font-data);color:var(--text-secondary)">${t.riskValue || '-'}${t.riskType === 'percentage' ? '%' : '$'}</span></div>
        <div><span style="color:var(--text-muted)">Mental </span><span style="color:var(--text-secondary)">${t.mentalState || '-'}</span></div>
        <div><span style="color:var(--text-muted)">Reglas </span><span style="font-family:var(--font-data);color:${t.rulesFollowed === 'No' ? 'var(--loss-red)' : t.rulesFollowed === 'Parcial' ? 'var(--win-gold)' : '#4ade80'}">${t.rulesFollowed || 'Sí'}</span></div>
      </div>
      <!-- Price levels -->
      ${(t.entryPrice || t.slPrice || t.tpPrice) ? `
      <div class="flex flex-wrap gap-x-3 gap-y-1 mb-2 px-2 py-1.5" style="background:var(--bg-elevated);border-radius:6px;font-family:var(--font-data);font-size:11px">
        ${t.entryPrice ? `<span style="color:var(--text-muted)">E <span style="color:var(--text-primary)">${t.entryPrice}</span></span>` : ''}
        ${t.slPrice    ? `<span style="color:var(--text-muted)">SL <span style="color:var(--loss-red)">${t.slPrice}</span></span>` : ''}
        ${t.tpPrice    ? `<span style="color:var(--text-muted)">TP <span style="color:#4ade80">${t.tpPrice}</span></span>` : ''}
        ${t.closePrice ? `<span style="color:var(--text-muted)">C <span style="color:#93c5fd">${t.closePrice}</span></span>` : ''}
        ${t.duration   ? `<span style="color:var(--text-muted);margin-left:auto"><i class="fas fa-clock mr-1" style="color:var(--accent-blue);opacity:0.7"></i>${t.duration >= 60 ? Math.floor(t.duration/60)+'h '+(t.duration%60)+'m' : t.duration+'m'}</span>` : ''}
      </div>` : ''}
      <!-- Loss cause -->
      ${t.lossCause ? `<div class="mb-2" style="font-size:11px;color:var(--loss-red)"><i class="fas fa-exclamation-circle mr-1"></i>${t.lossCause}</div>` : ''}
      <!-- Tags -->
      ${(t.tags && t.tags.length) ? `<div class="flex flex-wrap gap-1 mb-2">${t.tags.map(tag => `<span class="tag-pill-sm">${tag}</span>`).join('')}</div>` : ''}
      <!-- Checklist score -->
      ${(t.checklist && t.checklist.length) ? (() => {
        const checked = t.checklist.filter(c => c.checked).length;
        const total   = t.checklist.length;
        const score   = Math.round(checked / total * 100);
        const c = score === 100 ? 'var(--win-gold)' : score >= 70 ? '#fb923c' : 'var(--loss-red)';
        return `<div class="flex items-center gap-1 mb-1" style="font-size:11px;color:${c};font-family:var(--font-data)"><i class="fas fa-clipboard-check"></i> ${checked}/${total} checklist</div>`;
      })() : ''}
      <!-- Notes -->
      ${t.notes ? `<div class="mt-1" style="font-size:11px;color:var(--text-muted);font-style:italic">"${t.notes.substring(0,80)}${t.notes.length>80?'…':''}"</div>` : ''}
    </div>`;
  }).join('');
}
