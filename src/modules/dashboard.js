/**
 * dashboard.js — Sección Dashboard
 * Todas las funciones reciben `j` (instancia de TradingJournal)
 * para acceder al estado sin acoplamiento circular.
 */
import { calcPL } from '../utils/calculations.js';

export function renderDashboard(j) {
  const acc = j.getAccountById(j.activeAccount); if (!acc) return;
  const trades = j.trades.filter(t => t.accountId === j.activeAccount && t.result !== 'OPEN');
  const bal = j.getAccountBalance(j.activeAccount);
  const pnl = bal - acc.initialCapital;
  const pct = pnl / acc.initialCapital * 100;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dashAccountName', acc.name);
  set('dashAccountType', `Capital inicial: $${acc.initialCapital.toLocaleString('en')}`);
  set('dashCurrentBalance', '$' + bal.toFixed(2));
  const pnlEl = document.getElementById('dashPnl');
  if (pnlEl) {
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
    pnlEl.style.color = pnl >= 0 ? '#22c55e' : '#ef4444';
  }

  if (acc.maxDD || acc.target) {
    document.getElementById('ddSection')?.classList.remove('hidden');
    const ddP = Math.max(0, -pct);
    const ddW = Math.min(100, (ddP / (acc.maxDD || 8)) * 100);
    const ddC = ddP < (acc.maxDD || 8) * 0.5 ? '#22c55e' : ddP < (acc.maxDD || 8) * 0.8 ? '#f59e0b' : '#ef4444';
    const ddL = document.getElementById('ddLabel'); if (ddL) { ddL.textContent = ddP.toFixed(2) + '%'; ddL.style.color = ddC; }
    const ddF = document.getElementById('ddFill'); if (ddF) { ddF.style.width = ddW + '%'; ddF.style.background = ddC; }
    const tP = Math.max(0, pct); const tW = Math.min(100, (tP / (acc.target || 10)) * 100);
    set('targetLabel', tP.toFixed(2) + '% / ' + (acc.target || 10) + '%');
    const tF = document.getElementById('targetFill'); if (tF) tF.style.width = tW + '%';
  }

  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const wr = (wins.length + losses.length) > 0 ? (wins.length / (wins.length + losses.length) * 100) : 0;
  const gW = wins.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const gL = Math.abs(losses.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0));
  const pf = gL > 0 ? gW / gL : (wins.length > 0 ? 999 : 0);
  const rrV = trades.filter(t => parseFloat(t.rrReal) > 0).map(t => parseFloat(t.rrReal));
  const avgRR = rrV.length ? rrV.reduce((a, b) => a + b, 0) / rrV.length : 0;
  const planRR = trades.length ? trades.reduce((s, t) => s + (parseFloat(t.rrPlanned) || 0), 0) / trades.length : 0;
  let cap2 = acc.initialCapital, peak2 = acc.initialCapital, mdd = 0, streak = 0, cur = 0;
  [...trades].reverse().forEach(t => { cap2 += calcPL(t, acc.initialCapital); if (cap2 > peak2) peak2 = cap2; const dd = (peak2 - cap2) / peak2 * 100; if (dd > mdd) mdd = dd; });
  trades.forEach(t => { cur = t.result === 'LOSS' ? cur + 1 : 0; if (cur > streak) streak = cur; });
  set('dashWinRate', wr.toFixed(1) + '%'); set('dashTotalTrades', trades.length);
  set('dashPF', pf === 999 ? '∞' : pf.toFixed(2)); set('dashAvgRR', avgRR.toFixed(2));
  set('dashPlannedRR', planRR.toFixed(2)); set('dashMaxDD', mdd.toFixed(1) + '%'); set('dashStreak', streak);

  const noData = ['resultsChart', 'capitalChart', 'setupChart', 'pairChart', 'ddHistChart', 'pnlDayChart'];
  if (!trades.length) {
    noData.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<p class="text-slate-500 text-xs text-center py-8">Sin datos</p>'; });
    renderAdvancedMetrics(j, [], acc); renderCalendar(j); return;
  }

  chartResults(trades); chartCapital(j, trades, acc);
  chartSetups(j, trades); chartPairs(j, trades, acc);
  chartDDHistory(j, trades, acc); chartPnLByDay(j, trades, acc);
  renderAdvancedMetrics(j, trades, acc); renderCalendar(j);
  renderMultiAccountTabs(j);
}

function chartResults(trades) {
  const w = trades.filter(t => t.result === 'WIN').length;
  const l = trades.filter(t => t.result === 'LOSS').length;
  const b = trades.filter(t => t.result === 'BE').length;
  if (!(w + l + b)) return;
  Plotly.newPlot('resultsChart',
    [{ values: [w, l, b], labels: ['WIN', 'LOSS', 'BE'], type: 'pie', marker: { colors: ['#22c55e', '#ef4444', '#fb923c'] }, textinfo: 'label+percent', textposition: 'outside' }],
    { showlegend: false, margin: { t: 10, b: 10, l: 10, r: 10 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' } },
    { displayModeBar: false, responsive: true });
}

function chartCapital(j, trades, acc) {
  const sorted = [...trades].reverse(); const caps = [acc.initialCapital]; let c = acc.initialCapital; const labels = ['Inicio'];
  sorted.forEach(t => { c += calcPL(t, acc.initialCapital); caps.push(c); labels.push(t.date || ''); });
  Plotly.newPlot('capitalChart',
    [{ x: labels, y: caps, type: 'scatter', mode: 'lines', line: { color: '#3b82f6', width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(59,130,246,0.1)' }],
    { xaxis: { showticklabels: false, color: '#94a3b8' }, yaxis: { color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 10, b: 20, l: 55, r: 10 } },
    { displayModeBar: false, responsive: true });
}

function chartSetups(j, trades) {
  const stats = {}; trades.forEach(t => { const k = t.poi || 'Sin setup'; if (!stats[k]) stats[k] = { w: 0, tot: 0 }; stats[k].tot++; if (t.result === 'WIN') stats[k].w++; });
  const keys = Object.keys(stats).sort((a, b) => stats[b].tot - stats[a].tot).slice(0, 8);
  if (!keys.length) return;
  Plotly.newPlot('setupChart',
    [{ x: keys, y: keys.map(k => (stats[k].w / stats[k].tot * 100).toFixed(1)), type: 'bar', marker: { color: keys.map(k => stats[k].w / stats[k].tot >= 0.5 ? '#22c55e' : '#ef4444') }, text: keys.map(k => `${stats[k].tot}t`), textposition: 'outside' }],
    { xaxis: { color: '#94a3b8', tickangle: -30 }, yaxis: { title: 'WR%', color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 20, b: 70, l: 45, r: 10 } },
    { displayModeBar: false, responsive: true });
}

function chartPairs(j, trades, acc) {
  const stats = {}; trades.forEach(t => { const k = t.pair || '?'; if (!stats[k]) stats[k] = { w: 0, tot: 0, pl: 0 }; stats[k].tot++; if (t.result === 'WIN') stats[k].w++; stats[k].pl += calcPL(t, acc.initialCapital); });
  const keys = Object.keys(stats); if (!keys.length) return;
  Plotly.newPlot('pairChart',
    [{ x: keys, y: keys.map(k => stats[k].pl.toFixed(2)), type: 'bar', marker: { color: keys.map(k => stats[k].pl >= 0 ? '#22c55e' : '#ef4444') }, text: keys.map(k => `WR ${(stats[k].w / stats[k].tot * 100).toFixed(0)}%`), textposition: 'outside' }],
    { xaxis: { color: '#94a3b8' }, yaxis: { title: 'P&L $', color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 20, b: 40, l: 55, r: 10 } },
    { displayModeBar: false, responsive: true });
}

function chartDDHistory(j, trades, acc) {
  if (!trades.length) return;
  const sorted = [...trades].reverse(); let cap = acc.initialCapital, peak = acc.initialCapital; const dds = [], labels = [];
  sorted.forEach(t => { cap += calcPL(t, acc.initialCapital); if (cap > peak) peak = cap; dds.push(((peak - cap) / peak * 100).toFixed(2)); labels.push(t.date || ''); });
  Plotly.newPlot('ddHistChart',
    [{ x: labels, y: dds, type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color: '#ef4444', width: 1.5 }, fillcolor: 'rgba(239,68,68,0.1)' }],
    { xaxis: { showticklabels: false, color: '#94a3b8' }, yaxis: { title: 'DD%', color: '#94a3b8', autorange: 'reversed' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 10, b: 20, l: 45, r: 10 } },
    { displayModeBar: false, responsive: true });
}

function chartPnLByDay(j, trades, acc) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; const dayPL = {}; days.forEach(d => dayPL[d] = 0);
  trades.forEach(t => { const dn = new Date(t.date + 'T12:00:00').getDay(); if (!isNaN(dn)) dayPL[days[dn]] += calcPL(t, acc.initialCapital); });
  const k = days.filter(d => dayPL[d] !== 0); if (!k.length) return;
  Plotly.newPlot('pnlDayChart',
    [{ x: k, y: k.map(d => dayPL[d].toFixed(2)), type: 'bar', marker: { color: k.map(d => dayPL[d] >= 0 ? '#22c55e' : '#ef4444') } }],
    { xaxis: { color: '#94a3b8' }, yaxis: { title: 'P&L $', color: '#94a3b8' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8' }, margin: { t: 10, b: 40, l: 55, r: 10 } },
    { displayModeBar: false, responsive: true });
}

export function renderAdvancedMetrics(j, trades, acc) {
  let curStreak = 0, curType = 'none';
  for (let i = 0; i < trades.length; i++) {
    const r = trades[i].result;
    if (i === 0) { curType = r === 'WIN' ? 'win' : r === 'LOSS' ? 'loss' : 'none'; curStreak = 1; }
    else if ((r === 'WIN' && curType === 'win') || (r === 'LOSS' && curType === 'loss')) curStreak++;
    else break;
  }
  const pill = document.getElementById('currentStreakPill');
  if (pill) {
    if (curType === 'win')       { pill.className = 'streak-pill streak-win';  pill.innerHTML = `<i class="fas fa-fire"></i> ${curStreak} WIN seguidos`; }
    else if (curType === 'loss') { pill.className = 'streak-pill streak-loss'; pill.innerHTML = `<i class="fas fa-times-circle"></i> ${curStreak} LOSS seguidos`; }
    else                         { pill.className = 'streak-pill streak-none'; pill.innerHTML = `<i class="fas fa-minus"></i> Sin operaciones`; }
  }
  let bst = 0, wst = 0, wc = 0, lc = 0;
  [...trades].reverse().forEach(t => { if (t.result === 'WIN') { wc++; lc = 0; if (wc > bst) bst = wc; } else if (t.result === 'LOSS') { lc++; wc = 0; if (lc > wst) wst = lc; } else { wc = 0; lc = 0; } });
  const bsEl = document.getElementById('dashBestStreak');  if (bsEl) bsEl.textContent = bst;
  const wsEl = document.getElementById('dashWorstStreak'); if (wsEl) wsEl.textContent = wst;
  const totalPL = trades.reduce((s, t) => s + calcPL(t, acc.initialCapital), 0);
  const exp = trades.length ? totalPL / trades.length : 0;
  const expEl = document.getElementById('dashExpectancy');
  if (expEl) { expEl.textContent = (exp >= 0 ? '+' : '') + '$' + exp.toFixed(2); expEl.style.color = exp >= 0 ? '#4ade80' : '#f87171'; }
  const mMap = {}; trades.forEach(t => { const k = (t.date || '').slice(0, 7); if (!mMap[k]) mMap[k] = 0; mMap[k] += calcPL(t, acc.initialCapital); });
  const mVals = Object.values(mMap); let sharpe = 0;
  if (mVals.length > 1) { const mean = mVals.reduce((a, b) => a + b, 0) / mVals.length; const std = Math.sqrt(mVals.reduce((s, v) => s + (v - mean) ** 2, 0) / mVals.length); sharpe = std > 0 ? (mean / std * Math.sqrt(12)) : 0; }
  const shEl = document.getElementById('dashSharpe');
  if (shEl) { shEl.textContent = sharpe.toFixed(2); shEl.style.color = sharpe >= 1 ? '#4ade80' : sharpe >= 0.5 ? '#fb923c' : '#f87171'; }
}

export function renderMultiAccountTabs(j) {
  const stats = document.getElementById('multiAccStats'); if (!stats) return;
  stats.innerHTML = j.accounts.map(a => {
    const bal = j.getAccountBalance(a.id); const pnl = bal - a.initialCapital; const pct = pnl / a.initialCapital * 100;
    const ddP = pct < 0 ? Math.abs(pct) : 0; const ddW = a.maxDD ? Math.min(100, ddP / a.maxDD * 100) : 0;
    const t = j.trades.filter(x => x.accountId === a.id && x.result !== 'OPEN');
    const w = t.filter(x => x.result === 'WIN').length; const l = t.filter(x => x.result === 'LOSS').length;
    const wr = (w + l) > 0 ? (w / (w + l) * 100) : 0;
    return `<div class="risk-manager mb-2">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${a.color}"></div>
        <span class="font-semibold text-sm text-white flex-1">${a.name}</span>
        <span class="font-bold text-sm" style="color:${pnl >= 0 ? '#4ade80' : '#f87171'}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>
      </div>
      <div class="risk-row"><span class="risk-k">Balance</span><span class="text-white font-semibold">$${bal.toFixed(2)}</span></div>
      <div class="risk-row"><span class="risk-k">P&L</span><span style="color:${pnl >= 0 ? '#4ade80' : '#f87171'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span></div>
      <div class="risk-row"><span class="risk-k">Win Rate</span><span class="text-white">${wr.toFixed(1)}% (${t.length} ops)</span></div>
      ${a.maxDD ? `<div class="risk-row"><span class="risk-k">DD ${ddP.toFixed(2)}% / ${a.maxDD}% máx</span><span style="color:${ddP < a.maxDD * 0.5 ? '#4ade80' : ddP < a.maxDD * 0.8 ? '#fb923c' : '#f87171'}">${ddP < a.maxDD * 0.5 ? 'OK' : ddP < a.maxDD * 0.8 ? '⚠ Atención' : '🔴 Peligro'}</span></div>
      <div class="progress-bar mt-1 mb-1"><div class="progress-fill" style="width:${ddW}%;background:${ddP < a.maxDD * 0.5 ? '#22c55e' : ddP < a.maxDD * 0.8 ? '#f59e0b' : '#ef4444'}"></div></div>` : ''}
    </div>`;
  }).join('') || '<p class="text-xs text-slate-500">Sin cuentas</p>';
}

export function initCalendar(j) {
  document.getElementById('calPrev')?.addEventListener('click', () => { j._calDate.setMonth(j._calDate.getMonth() - 1); renderCalendar(j); });
  document.getElementById('calNext')?.addEventListener('click', () => { j._calDate.setMonth(j._calDate.getMonth() + 1); renderCalendar(j); });
  renderCalendar(j);
}

export function renderCalendar(j) {
  const d = j._calDate, y = d.getFullYear(), m = d.getMonth();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const tEl = document.getElementById('calTitle'); if (tEl) tEl.textContent = `${months[m]} ${y}`;
  const grid = document.getElementById('calGrid'); if (!grid) return;
  const acc = j.getAccountById(j.activeAccount);
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const trades = j.trades.filter(t => t.accountId === j.activeAccount && t.date?.startsWith(prefix) && t.result !== 'OPEN');
  const byDay = {};
  trades.forEach(t => { const day = parseInt(t.date?.slice(8, 10) || 0); if (!byDay[day]) byDay[day] = { pl: 0, w: 0, l: 0, b: 0 }; byDay[day].pl += acc ? calcPL(t, acc.initialCapital) : 0; if (t.result === 'WIN') byDay[day].w++; else if (t.result === 'LOSS') byDay[day].l++; else byDay[day].b++; });
  const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date(); let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const data = byDay[day]; const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
    let cls = 'cal-day'; let val = '';
    if (data) { cls += data.pl > 0 ? ' win' : data.pl < 0 ? ' loss' : ' be'; val = `<div class="cal-val">${data.pl >= 0 ? '+' : ''}${data.pl.toFixed(0)}</div>`; }
    if (isToday) cls += ' today';
    html += `<div class="${cls}"><div class="cal-num">${day}</div>${val}</div>`;
  }
  grid.innerHTML = html;
  const totalPL = Object.values(byDay).reduce((s, d) => s + d.pl, 0);
  const totalW  = Object.values(byDay).reduce((s, d) => s + d.w, 0);
  const totalL  = Object.values(byDay).reduce((s, d) => s + d.l, 0);
  const smry = document.getElementById('calMonthSummary');
  if (smry) smry.innerHTML = `
    <div class="bg-green-500/10 rounded p-2"><div class="text-green-400 font-bold">${totalW}</div><div class="text-slate-500 text-xs">Wins</div></div>
    <div class="bg-red-500/10 rounded p-2"><div class="text-red-400 font-bold">${totalL}</div><div class="text-slate-500 text-xs">Losses</div></div>
    <div class="rounded p-2" style="background:${totalPL >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}"><div class="font-bold" style="color:${totalPL >= 0 ? '#4ade80' : '#f87171'}">${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(0)}</div><div class="text-slate-500 text-xs">P&L Mes</div></div>`;
}
