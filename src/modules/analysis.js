/**
 * analysis.js — Sección Análisis
 */
import { calcPL, getTradeDuration, fmtDur } from '../utils/calculations.js';

export function renderAnalysis(j) {
  const acc    = j.getAccountById(j.activeAccount);
  const trades = j.trades.filter(t => t.accountId === j.activeAccount && t.result !== 'OPEN');
  if (!trades.length) return;

  j._heatmapMode = j._heatmapMode || 'wr';
  renderHeatmap(j, trades, acc);
  setupHeatmapToggle(j, trades, acc);

  // Win Rate por Día
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']; const dS = {}; days.forEach(d => dS[d] = { w: 0, t: 0 });
  trades.forEach(t => { const dn = new Date(t.date + 'T12:00:00').getDay(); if (!isNaN(dn)) { const d = days[dn]; dS[d].t++; if (t.result === 'WIN') dS[d].w++; } });
  const dK = days.filter(d => dS[d].t > 0);
  Plotly.newPlot('dayChart', [{ x: dK, y: dK.map(d => (dS[d].w / dS[d].t * 100).toFixed(1)), type: 'bar', marker: { color: dK.map(d => dS[d].w / dS[d].t >= 0.5 ? '#f59e0b' : '#ef4444') }, text: dK.map(d => dS[d].t + 't'), textposition: 'outside' }],
    { xaxis: { color: '#94a3b8' }, yaxis: { title: 'WR%', color: '#94a3b8', range: [0, 110] }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 20, b: 40, l: 45, r: 10 } },
    { displayModeBar: false, responsive: true });

  // Win Rate por Sesión
  const sS = {}; trades.forEach(t => { const s = t.session || 'Otra'; if (!sS[s]) sS[s] = { w: 0, t: 0 }; sS[s].t++; if (t.result === 'WIN') sS[s].w++; });
  const sK = Object.keys(sS);
  Plotly.newPlot('sessionChart', [{ x: sK, y: sK.map(s => (sS[s].w / sS[s].t * 100).toFixed(1)), type: 'bar', marker: { color: '#14b8a6' }, text: sK.map(s => sS[s].t + 't'), textposition: 'outside' }],
    { xaxis: { color: '#94a3b8' }, yaxis: { title: 'WR%', color: '#94a3b8', range: [0, 110] }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 20, b: 40, l: 45, r: 10 } },
    { displayModeBar: false, responsive: true });

  renderDurationAnalysis(j, trades, acc);
  renderStatBlock('mentalStats', trades, t => t.mentalState || 'Neutro');
  renderStatBlock('rulesStats',  trades, t => t.rulesFollowed || 'Sí');
  renderStatBlock('lossStats',   trades.filter(t => t.result === 'LOSS'), t => t.lossCause || 'No especificada');
  renderStatBlock('fibStats',    trades.filter(t => t.fibLevel), t => t.fibLevel + '%');
  renderPivotTable(j, trades);
  renderTagStats(trades);

  if (!j._pivotListeners) {
    j._pivotListeners = true;
    ['pivotDimA', 'pivotDimB'].forEach(id => document.getElementById(id)?.addEventListener('change', () => renderPivotTable(j, trades)));
  }
}

export function renderHeatmap(j, trades, acc) {
  const dayOrder = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const dowMap   = { 1:'Lun', 2:'Mar', 3:'Mié', 4:'Jue', 5:'Vie', 6:'Sáb', 0:'Dom' };
  const mat = {};
  dayOrder.forEach(d => { mat[d] = {}; for (let h = 0; h < 24; h++) mat[d][h] = { w: 0, l: 0, t: 0, pl: 0 }; });
  trades.forEach(t => {
    const h   = parseInt((t.time || '00:00').split(':')[0]);
    const dow = new Date(t.date + 'T12:00:00').getDay();
    const day = dowMap[dow];
    if (!day || isNaN(h)) return;
    mat[day][h].t++;
    if (t.result === 'WIN') mat[day][h].w++;
    else if (t.result === 'LOSS') mat[day][h].l++;
    if (acc) mat[day][h].pl += calcPL(t, acc.initialCapital);
  });
  const activeHours = [...new Set(dayOrder.flatMap(d => Object.keys(mat[d]).filter(h => mat[d][h].t > 0).map(Number)))].sort((a, b) => a - b);
  if (!activeHours.length) { document.getElementById('heatmapChart').innerHTML = '<p class="text-xs text-slate-500 text-center py-8">Sin datos suficientes.</p>'; return; }
  const isWR = j._heatmapMode !== 'pl';
  const z = dayOrder.map(d => activeHours.map(h => { const c = mat[d][h]; if (!c.t) return null; return isWR ? parseFloat((c.w / c.t * 100).toFixed(1)) : parseFloat(c.pl.toFixed(2)); }));
  const textM = dayOrder.map(d => activeHours.map(h => { const c = mat[d][h]; if (!c.t) return ''; return isWR ? `${(c.w / c.t * 100).toFixed(0)}%<br>${c.t}t` : `$${c.pl.toFixed(0)}<br>${c.t}t`; }));
  const colorscale = isWR
    ? [[0,'#7f1d1d'],[0.4,'#ef4444'],[0.5,'#f59e0b'],[0.65,'#22c55e'],[1,'#14532d']]
    : [[0,'#7f1d1d'],[0.5,'#334155'],[1,'#14532d']];
  Plotly.newPlot('heatmapChart', [{ type: 'heatmap', z, x: activeHours.map(h => h + ':00'), y: dayOrder, text: textM, hovertemplate: '%{y} %{x}<br>' + (isWR ? 'WR: %{z}%' : 'P&L: $%{z}') + '<extra></extra>', colorscale, zmin: isWR ? 0 : undefined, zmax: isWR ? 100 : undefined, showscale: true, colorbar: { tickfont: { color: '#94a3b8', size: 9 }, len: 0.8, thickness: 10, title: { text: isWR ? 'WR%' : 'P&L $', font: { color: '#94a3b8', size: 9 } } } }],
    { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, xaxis: { color: '#94a3b8', tickangle: -60, tickfont: { size: 9 } }, yaxis: { color: '#94a3b8', tickfont: { size: 10 } }, margin: { t: 10, b: 65, l: 40, r: 55 } },
    { displayModeBar: false, responsive: true });

  // Best hours insights
  const el = document.getElementById('bestHoursInsight'); if (!el) return;
  const hourTotals = {};
  dayOrder.forEach(d => activeHours.forEach(h => {
    const c = mat[d][h]; if (!c.t) return;
    if (!hourTotals[h]) hourTotals[h] = { w: 0, t: 0, pl: 0 };
    hourTotals[h].w += c.w; hourTotals[h].t += c.t; hourTotals[h].pl += c.pl;
  }));
  const sorted = Object.entries(hourTotals).filter(([, v]) => v.t >= 2).sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t));
  if (!sorted.length) { el.innerHTML = ''; return; }
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const bestWR = (best[1].w / best[1].t * 100).toFixed(0);
  const worstWR = (worst[1].w / worst[1].t * 100).toFixed(0);
  const pills = [];
  pills.push(`<div class="insight-pill insight-positive" style="display:flex;width:100%;border-radius:.5rem;padding:7px 12px;margin:2px 0"><i class="fas fa-star mr-2"></i><span class="text-xs">Mejor hora: <b>${best[0]}:00</b> — WR ${bestWR}% (${best[1].t} ops)</span></div>`);
  if (worst[0] !== best[0] && parseInt(worstWR) < 50)
    pills.push(`<div class="insight-pill insight-negative" style="display:flex;width:100%;border-radius:.5rem;padding:7px 12px;margin:2px 0"><i class="fas fa-exclamation-triangle mr-2"></i><span class="text-xs">Peor hora: <b>${worst[0]}:00</b> — WR ${worstWR}% (${worst[1].t} ops)</span></div>`);
  const dayTotals = {};
  dayOrder.forEach(d => { dayTotals[d] = { w: 0, t: 0 }; activeHours.forEach(h => { const c = mat[d][h]; dayTotals[d].w += c.w; dayTotals[d].t += c.t; }); });
  const bestDay = Object.entries(dayTotals).filter(([, v]) => v.t >= 2).sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t))[0];
  if (bestDay) pills.push(`<div class="insight-pill insight-neutral" style="display:flex;width:100%;border-radius:.5rem;padding:7px 12px;margin:2px 0"><i class="fas fa-calendar-check mr-2"></i><span class="text-xs">Mejor día: <b>${bestDay[0]}</b> — WR ${(bestDay[1].w / bestDay[1].t * 100).toFixed(0)}%</span></div>`);
  el.innerHTML = pills.join('');
}

export function setupHeatmapToggle(j, trades, acc) {
  if (j._heatmapToggleInit) return; j._heatmapToggleInit = true;
  document.getElementById('heatmapToggleWR')?.addEventListener('click', () => {
    j._heatmapMode = 'wr';
    document.getElementById('heatmapToggleWR')?.classList.add('active');
    document.getElementById('heatmapTogglePL')?.classList.remove('active');
    document.getElementById('heatmapChart').innerHTML = '';
    renderHeatmap(j, trades, acc);
  });
  document.getElementById('heatmapTogglePL')?.addEventListener('click', () => {
    j._heatmapMode = 'pl';
    document.getElementById('heatmapTogglePL')?.classList.add('active');
    document.getElementById('heatmapToggleWR')?.classList.remove('active');
    document.getElementById('heatmapChart').innerHTML = '';
    renderHeatmap(j, trades, acc);
  });
}

export function renderDurationAnalysis(j, trades, acc) {
  const chartEl = document.getElementById('durationChart');
  const statsEl = document.getElementById('durationStats');
  const emptyEl = document.getElementById('durationEmpty');
  const tradesWithDur = trades.map(t => ({ ...t, _dur: getTradeDuration(t) })).filter(t => t._dur !== null && t._dur > 0);
  if (tradesWithDur.length < 3) {
    chartEl?.classList.add('hidden'); statsEl?.classList.add('hidden'); emptyEl?.classList.remove('hidden'); return;
  }
  emptyEl?.classList.add('hidden'); chartEl?.classList.remove('hidden'); statsEl?.classList.remove('hidden');
  const groups = { WIN: [], LOSS: [], BE: [] };
  tradesWithDur.forEach(t => { if (groups[t.result]) groups[t.result].push(t._dur); });
  const cats = Object.keys(groups).filter(k => groups[k].length > 0);
  const avgs = cats.map(k => groups[k].reduce((a, b) => a + b, 0) / groups[k].length);
  Plotly.newPlot('durationChart', [{ type: 'bar', x: cats, y: avgs.map(v => parseFloat((v / 60).toFixed(2))), marker: { color: cats.map(k => k === 'WIN' ? '#22c55e' : k === 'LOSS' ? '#ef4444' : '#fb923c') }, text: avgs.map(v => fmtDur(Math.round(v))), textposition: 'outside' }],
    { xaxis: { color: '#94a3b8' }, yaxis: { title: 'Horas', color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 25, b: 40, l: 50, r: 10 } },
    { displayModeBar: false, responsive: true });
  const allDurs = tradesWithDur.map(t => t._dur);
  const avgAll = allDurs.reduce((a, b) => a + b, 0) / allDurs.length;
  const minDur = Math.min(...allDurs), maxDur = Math.max(...allDurs);
  const winDurs  = tradesWithDur.filter(t => t.result === 'WIN').map(t => t._dur);
  const lossDurs = tradesWithDur.filter(t => t.result === 'LOSS').map(t => t._dur);
  const avgWin  = winDurs.length  ? winDurs.reduce((a, b) => a + b, 0)  / winDurs.length  : 0;
  const avgLoss = lossDurs.length ? lossDurs.reduce((a, b) => a + b, 0) / lossDurs.length : 0;
  const durationEdge = avgWin > 0 && avgLoss > 0 ? (avgWin > avgLoss ? 'Los winners duran más' : 'Los losses duran más') : '–';
  statsEl.innerHTML = [
    { l: 'Duración promedio', v: fmtDur(Math.round(avgAll)), c: 'text-slate-300' },
    { l: 'Más corto',         v: fmtDur(minDur),             c: 'text-blue-300' },
    { l: 'Más largo',         v: fmtDur(maxDur),             c: 'text-purple-300' },
    { l: 'Edge temporal',     v: durationEdge,               c: avgWin > avgLoss ? 'text-green-400' : 'text-yellow-400' },
  ].map(s => `<div class="adv-metric"><div class="adv-label">${s.l}</div><div class="adv-val ${s.c}" style="font-size:1rem">${s.v}</div></div>`).join('');
}

export function renderStatBlock(id, trades, keyFn) {
  const el = document.getElementById(id); if (!el) return;
  const stats = {};
  trades.forEach(t => { const k = keyFn(t); if (!stats[k]) stats[k] = { w: 0, t: 0 }; stats[k].t++; if (t.result === 'WIN') stats[k].w++; });
  if (!Object.keys(stats).length) { el.innerHTML = '<p class="text-slate-500 text-xs">Sin datos</p>'; return; }
  el.innerHTML = Object.entries(stats).sort((a, b) => b[1].t - a[1].t).map(([k, s]) => {
    const wr = (s.w / s.t * 100).toFixed(1); const color = s.w / s.t >= 0.5 ? 'text-green-400' : 'text-red-400';
    return `<div class="flex justify-between items-center py-1 border-b border-slate-700/40"><span class="text-slate-300 text-xs">${k}</span><span class="${color} font-medium text-xs">${wr}% (${s.t}t)</span></div>`;
  }).join('');
}

export function renderPivotTable(j, trades) {
  const el = document.getElementById('pivotTable'); if (!el) return;
  const dimA = document.getElementById('pivotDimA')?.value || 'mentalState';
  const dimB = document.getElementById('pivotDimB')?.value || 'session';
  if (dimA === dimB) { el.innerHTML = '<p class="text-xs text-slate-500">Selecciona dimensiones diferentes.</p>'; return; }
  const getVal = (t, dim) => t[dim] || '-';
  const rowVals = [...new Set(trades.map(t => getVal(t, dimA)))].filter(v => v && v !== '-').slice(0, 8);
  const colVals = [...new Set(trades.map(t => getVal(t, dimB)))].filter(v => v && v !== '-').slice(0, 7);
  if (!rowVals.length || !colVals.length) { el.innerHTML = '<p class="text-xs text-slate-500">Sin datos suficientes.</p>'; return; }
  const mat = {};
  rowVals.forEach(r => { mat[r] = {}; colVals.forEach(c => mat[r][c] = { w: 0, t: 0 }); });
  trades.forEach(t => { const r = getVal(t, dimA), c = getVal(t, dimB); if (mat[r] && mat[r][c] !== undefined) { mat[r][c].t++; if (t.result === 'WIN') mat[r][c].w++; } });
  const dimLabels = { mentalState: 'Mental', session: 'Sesión', pair: 'Activo', strategy: 'Estrategia', rulesFollowed: 'Reglas', trendHTF: 'HTF', direction: 'Dir' };
  let html = `<table class="pivot-tbl"><thead><tr><th style="text-align:left">${dimLabels[dimA] || dimA} \\ ${dimLabels[dimB] || dimB}</th>`;
  colVals.forEach(c => html += `<th>${c}</th>`);
  html += '</tr></thead><tbody>';
  rowVals.forEach(r => {
    html += `<tr><td style="text-align:left;color:#94a3b8;font-weight:500">${r}</td>`;
    colVals.forEach(c => {
      const cell = mat[r][c];
      if (!cell.t) { html += `<td class="pv-empty">—</td>`; return; }
      const wr = cell.w / cell.t;
      const cls = wr >= 0.6 ? 'pv-high' : wr >= 0.4 ? 'pv-mid' : 'pv-low';
      html += `<td class="${cls}">${(wr * 100).toFixed(0)}%<br><span style="opacity:.6;font-size:.6rem">${cell.t}t</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = `<div class="pivot-wrap">${html}</div>`;
}

export function renderTagStats(trades) {
  const statsEl = document.getElementById('tagStats');
  const emptyEl = document.getElementById('tagStatsEmpty');
  if (!statsEl || !emptyEl) return;
  const tagMap = {};
  trades.forEach(t => (t.tags || []).forEach(tag => {
    if (!tagMap[tag]) tagMap[tag] = { w: 0, t: 0 };
    tagMap[tag].t++; if (t.result === 'WIN') tagMap[tag].w++;
  }));
  const entries = Object.entries(tagMap).sort((a, b) => b[1].t - a[1].t);
  if (!entries.length) { statsEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  statsEl.innerHTML = entries.map(([tag, s]) => {
    const wr = (s.w / s.t * 100).toFixed(1);
    const color = s.w / s.t >= 0.5 ? 'text-green-400' : 'text-red-400';
    return `<div class="flex justify-between items-center py-1 border-b border-slate-700/40"><span class="tag-pill-sm">${tag}</span><span class="${color} font-medium text-xs">${wr}% (${s.t}t)</span></div>`;
  }).join('');
}
