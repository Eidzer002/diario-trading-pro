/**
 * psychology.js — Sección Psicología
 */
import { calcPL } from '../utils/calculations.js';

export function renderPsychology(j) {
  const acc    = j.getAccountById(j.activeAccount); if (!acc) return;
  const trades = j.trades.filter(t => t.accountId === j.activeAccount && t.result !== 'OPEN');
  renderRiskManager(j, acc, trades);
  renderInsights(j, trades, acc);
  renderPsychDetail(j, trades, acc);
  renderRulesChart(trades, acc);
  initWeekNav(j);
  renderWeeklyReview(j, trades, acc);
  renderMonthlyReview(j, trades, acc);
}

export function renderRiskManager(j, acc, trades) {
  const el = document.getElementById('riskManagerContent'); if (!el) return;
  const bal = j.getAccountBalance(acc.id); const pnl = bal - acc.initialCapital; const pct = pnl / acc.initialCapital * 100;
  const ddP = pct < 0 ? Math.abs(pct) : 0; const riskAmt = bal * (acc.riskPerTrade || 1) / 100;
  const today = new Date().toISOString().split('T')[0];
  const todayPL = trades.filter(t => t.date === today).reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const ddLimit = acc.maxDD || 8;
  const tradesLeft = Math.floor((bal * (ddLimit / 100) - Math.max(0, Math.abs(Math.min(0, pnl)))) / Math.max(0.01, riskAmt));
  const ddC = ddP < ddLimit * 0.5 ? '#4ade80' : ddP < ddLimit * 0.8 ? '#fb923c' : '#f87171';
  el.innerHTML = `<div class="risk-manager">
    <div class="risk-row"><span class="risk-k">Capital actual</span><span class="text-white font-bold">$${bal.toFixed(2)}</span></div>
    <div class="risk-row"><span class="risk-k">P&L total</span><span style="color:${pnl >= 0 ? '#4ade80' : '#f87171'}" class="font-bold">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pct.toFixed(2)}%)</span></div>
    <div class="risk-row"><span class="risk-k">DD actual / máx</span><span style="color:${ddC}" class="font-bold">${ddP.toFixed(2)}% / ${ddLimit}%</span></div>
    <div class="risk-row"><span class="risk-k">P&L hoy</span><span style="color:${todayPL >= 0 ? '#4ade80' : '#f87171'}">${todayPL >= 0 ? '+' : ''}$${todayPL.toFixed(2)}</span></div>
    <div class="risk-row"><span class="risk-k">Riesgo próximo trade (${acc.riskPerTrade || 1}%)</span><span class="text-yellow-400 font-bold">$${riskAmt.toFixed(2)}</span></div>
    <div class="risk-row"><span class="risk-k">Trades posibles hasta límite</span><span class="text-white font-bold">${Math.max(0, tradesLeft)}</span></div>
  </div>
  ${ddP >= ddLimit ? `<div class="insight-pill insight-negative w-full justify-center mt-2"><i class="fas fa-stop-circle"></i> ¡LÍMITE DD ALCANZADO! Para de operar.</div>` : ddP > ddLimit * 0.7 ? `<div class="insight-pill insight-neutral w-full justify-center mt-2"><i class="fas fa-exclamation-triangle"></i> DD al ${ddP.toFixed(1)}% — Considera reducir el riesgo</div>` : ''}`;
}

export function renderInsights(j, trades, acc) {
  const el = document.getElementById('insightsContainer'); if (!el) return;
  if (trades.length < 10) { el.innerHTML = '<p class="text-xs text-slate-500">Registra al menos 10 operaciones para ver insights.</p>'; return; }
  const insights = [];
  const mWR = {}; trades.forEach(t => { const m = t.mentalState || 'Neutro'; if (!mWR[m]) mWR[m] = { w: 0, t: 0 }; mWR[m].t++; if (t.result === 'WIN') mWR[m].w++; });
  const mE = Object.entries(mWR).filter(([, v]) => v.t >= 3);
  const bestM  = mE.slice().sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t))[0];
  const worstM = mE.slice().sort((a, b) => (a[1].w / a[1].t) - (b[1].w / b[1].t))[0];
  if (bestM)  insights.push({ t: 'positive', tx: `<b>${bestM[0]}</b>: tu mejor estado mental — WR ${(bestM[1].w / bestM[1].t * 100).toFixed(0)}% (${bestM[1].t} ops)` });
  if (worstM && bestM && worstM[0] !== bestM[0]) insights.push({ t: 'negative', tx: `Evita operar en estado <b>${worstM[0]}</b> — WR ${(worstM[1].w / worstM[1].t * 100).toFixed(0)}%` });
  const rY = trades.filter(t => t.rulesFollowed === 'Sí'), rN = trades.filter(t => t.rulesFollowed === 'No');
  if (rY.length > 3 && rN.length > 3) {
    const wrY = rY.filter(t => t.result === 'WIN').length / Math.max(1, rY.filter(t => t.result !== 'BE').length) * 100;
    const wrN = rN.filter(t => t.result === 'WIN').length / Math.max(1, rN.filter(t => t.result !== 'BE').length) * 100;
    if (wrY > wrN) insights.push({ t: 'positive', tx: `Siguiendo reglas WR <b>${wrY.toFixed(0)}%</b> vs <b>${wrN.toFixed(0)}%</b> sin seguirlas. El sistema funciona.` });
  }
  const sWR = {}; trades.forEach(t => { const s = t.session || 'Otra'; if (!sWR[s]) sWR[s] = { w: 0, t: 0 }; sWR[s].t++; if (t.result === 'WIN') sWR[s].w++; });
  const bestS = Object.entries(sWR).filter(([, v]) => v.t >= 3).sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t))[0];
  if (bestS) insights.push({ t: 'positive', tx: `Mejor sesión: <b>${bestS[0]}</b> — WR ${(bestS[1].w / bestS[1].t * 100).toFixed(0)}%` });
  const setWR = {}; trades.filter(t => t.poi).forEach(t => { if (!setWR[t.poi]) setWR[t.poi] = { w: 0, t: 0 }; setWR[t.poi].t++; if (t.result === 'WIN') setWR[t.poi].w++; });
  const bestSet = Object.entries(setWR).filter(([, v]) => v.t >= 3).sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t))[0];
  if (bestSet) insights.push({ t: 'positive', tx: `Setup más efectivo: <b>${bestSet[0]}</b> — WR ${(bestSet[1].w / bestSet[1].t * 100).toFixed(0)}% (${bestSet[1].t} ops)` });
  const cMap = { positive: 'insight-positive', negative: 'insight-negative', neutral: 'insight-neutral' };
  el.innerHTML = insights.length
    ? insights.map(i => `<div class="${cMap[i.t] || 'insight-neutral'} insight-pill" style="display:flex;width:100%;border-radius:0.5rem;padding:8px 12px;margin:3px 0"><span style="font-size:12px">${i.tx}</span></div>`).join('')
    : '<p class="text-xs text-slate-500">Añade más detalles a tus operaciones.</p>';
}

export function renderPsychDetail(j, trades, acc) {
  const el = document.getElementById('psychDetailContainer'); if (!el) return;
  const colors = { 'Neutro': '#94a3b8', 'Confiado': '#22c55e', 'Ansioso': '#f59e0b', 'Eufórico': '#3b82f6', 'Venganza': '#ef4444', 'FOMO': '#f97316', 'Miedo': '#8b5cf6', 'Aburrido': '#64748b' };
  const stats = {}; trades.forEach(t => { const m = t.mentalState || 'Neutro'; if (!stats[m]) stats[m] = { w: 0, l: 0, b: 0, pl: 0 }; if (t.result === 'WIN') stats[m].w++; else if (t.result === 'LOSS') stats[m].l++; else stats[m].b++; stats[m].pl += calcPL(t, acc.initialCapital); });
  el.innerHTML = Object.entries(stats).sort((a, b) => (b[1].w + b[1].l + b[1].b) - (a[1].w + a[1].l + a[1].b)).map(([state, s]) => {
    const tot = s.w + s.l + s.b; const wr = (s.w + s.l) > 0 ? (s.w / (s.w + s.l) * 100) : 0; const c = colors[state] || '#94a3b8';
    return `<div class="psych-card" style="border-color:${c}33;background:${c}08">
      <div class="flex justify-between items-center"><span class="text-sm font-semibold" style="color:${c}">${state}</span><span class="text-xs text-slate-400">${tot} ops · WR ${wr.toFixed(0)}%</span></div>
      <div class="psych-bar mt-2"><div class="psych-fill" style="width:${wr}%;background:${c}"></div></div>
      <div class="flex justify-between text-xs mt-1"><span class="text-green-400">${s.w}W</span><span class="text-red-400">${s.l}L</span><span class="text-orange-400">${s.b}BE</span><span style="color:${s.pl >= 0 ? '#4ade80' : '#f87171'}">${s.pl >= 0 ? '+' : ''}$${s.pl.toFixed(0)}</span></div>
    </div>`;
  }).join('') || '<p class="text-xs text-slate-500">Sin datos.</p>';
}

export function renderRulesChart(trades, acc) {
  const cats = ['Sí', 'Parcial', 'No'];
  const cData = cats.map(cat => { const g = trades.filter(t => t.rulesFollowed === cat); const w = g.filter(t => t.result === 'WIN').length; const tot = g.filter(t => t.result !== 'BE').length; return { cat, wr: tot > 0 ? (w / tot * 100) : 0, count: g.length }; }).filter(d => d.count > 0);
  if (cData.length) {
    Plotly.newPlot('rulesAdherenceChart', [{ x: cData.map(d => d.cat), y: cData.map(d => d.wr.toFixed(1)), type: 'bar', marker: { color: ['#22c55e', '#f59e0b', '#ef4444'] }, text: cData.map(d => d.count + 't'), textposition: 'outside' }],
      { xaxis: { color: '#94a3b8' }, yaxis: { title: 'WR%', color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 20, b: 30, l: 45, r: 10 }, showlegend: false },
      { displayModeBar: false, responsive: true });
  }
  const bEl = document.getElementById('rulesBreakList');
  if (bEl) {
    const bCounts = {}; trades.filter(t => t.rulesBreak).forEach(t => { bCounts[t.rulesBreak] = (bCounts[t.rulesBreak] || 0) + 1; });
    bEl.innerHTML = Object.keys(bCounts).length
      ? '<p class="text-xs text-slate-500 mb-2">Reglas incumplidas frecuentes:</p>' + Object.entries(bCounts).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<div class="flex justify-between text-xs py-1 border-b border-slate-700/50"><span class="text-slate-300">${r}</span><span class="text-red-400 font-bold">${n}x</span></div>`).join('')
      : '<p class="text-xs text-slate-500">Sin reglas incumplidas registradas. ✅</p>';
  }
}

export function initWeekNav(j) {
  if (j._weekNavInit) return; j._weekNavInit = true; j._weekOffset = 0;
  document.getElementById('weekNavPrev')?.addEventListener('click', () => { j._weekOffset--; renderPsychWeek(j); });
  document.getElementById('weekNavNext')?.addEventListener('click', () => { if (j._weekOffset < 0) { j._weekOffset++; renderPsychWeek(j); } });
}

function renderPsychWeek(j) {
  const acc    = j.getAccountById(j.activeAccount); if (!acc) return;
  const trades = j.trades.filter(t => t.accountId === j.activeAccount && t.result !== 'OPEN');
  renderWeeklyReview(j, trades, acc);
}

export function renderWeeklyReview(j, trades, acc) {
  const el = document.getElementById('weeklyReviewContent'); if (!el) return;
  const now = new Date(); const offset = j._weekOffset || 0;
  const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + (offset * 7)); sow.setHours(0, 0, 0, 0);
  const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const s = sow.toISOString().split('T')[0]; const e = eow.toISOString().split('T')[0];
  const lbl = document.getElementById('weekLabel'); if (lbl) lbl.textContent = offset === 0 ? 'Esta semana' : `Sem. ${s}`;
  const wt = trades.filter(t => t.date >= s && t.date <= e);
  if (!wt.length) { el.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Sin operaciones.</p>'; return; }
  const w = wt.filter(t => t.result === 'WIN'), l = wt.filter(t => t.result === 'LOSS'), b = wt.filter(t => t.result === 'BE');
  const pl = wt.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const wr = (w.length + l.length) > 0 ? (w.length / (w.length + l.length) * 100) : 0;
  const pairCount = wt.reduce((m, t) => { m[t.pair] = (m[t.pair] || 0) + 1; return m; }, {});
  const topPair = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  el.innerHTML = `<div class="review-card">
    <h4>Resumen Semanal</h4>
    <div class="review-item">Operaciones<span>${wt.length}</span></div>
    <div class="review-item">W/L/BE<span><span class="text-green-400">${w.length}</span> / <span class="text-red-400">${l.length}</span> / <span class="text-orange-400">${b.length}</span></span></div>
    <div class="review-item">Win Rate<span style="color:${wr >= 50 ? '#4ade80' : '#f87171'}">${wr.toFixed(1)}%</span></div>
    <div class="review-item">P&L semana<span style="color:${pl >= 0 ? '#4ade80' : '#f87171'}">${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}</span></div>
    <div class="review-item">Activo principal<span>${topPair}</span></div>
    <div class="review-item">Reglas seguidas<span>${wt.filter(t => t.rulesFollowed === 'Sí').length} / ${wt.length}</span></div>
  </div>`;
}

export function renderMonthlyReview(j, trades, acc) {
  const el = document.getElementById('monthlyReviewContent'); if (!el) return;
  const now = new Date(); const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mt = trades.filter(t => t.date?.startsWith(prefix));
  if (!mt.length) { el.innerHTML = '<p class="text-xs text-slate-500">Sin operaciones este mes.</p>'; return; }
  const w = mt.filter(t => t.result === 'WIN'), l = mt.filter(t => t.result === 'LOSS');
  const pl = mt.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const wr = (w.length + l.length) > 0 ? (w.length / (w.length + l.length) * 100) : 0;
  const gW = w.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const gL = Math.abs(l.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0));
  const pf = gL > 0 ? gW / gL : 0;
  el.innerHTML = `<div class="review-card">
    <h4>Mes Actual</h4>
    <div class="review-item">Operaciones<span>${mt.length}</span></div>
    <div class="review-item">Win Rate<span style="color:${wr >= 50 ? '#4ade80' : '#f87171'}">${wr.toFixed(1)}%</span></div>
    <div class="review-item">Profit Factor<span style="color:${pf >= 1.5 ? '#4ade80' : pf >= 1 ? '#fb923c' : '#f87171'}">${pf.toFixed(2)}</span></div>
    <div class="review-item">P&L mes<span style="color:${pl >= 0 ? '#4ade80' : '#f87171'}">${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}</span></div>
  </div>`;
}
