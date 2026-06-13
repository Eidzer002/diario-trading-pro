/**
 * propfirm.js — Panel de seguimiento para cuentas PropFirm (v4.5.2)
 *
 * Novedades v4.5.2:
 * - Historial de DD diario (gráfico de línea P&L por día + línea límite)
 * - Contador de días de trading con progreso hacia días mínimos
 * - Sección "Reglas del reto" visual con los parámetros configurados
 */
import { showToast } from '../utils/helpers.js';
import { calcPL }    from '../utils/calculations.js';

// ── CÁLCULO PRINCIPAL ──────────────────────────────────────────────────────

export function calcPropFirmStatus(acc, trades) {
  if (!acc || acc.accountType !== 'propfirm') return null;

  const funded      = acc.initialCapital;
  const baseBalance = acc.currentCapital ?? funded;
  const maxDD_pct   = acc.maxDD    || 10;
  const dailyDD_pct = acc.dailyDD  || 5;
  const target_pct  = acc.target   || 10;

  // Límites absolutos en $
  const maxDD_limit   = funded * maxDD_pct   / 100;
  const dailyDD_limit = funded * dailyDD_pct / 100;
  const target_limit  = funded * target_pct  / 100;

  // Calcular balance actual acumulando trades sobre el balance base
  const closedTrades = trades.filter(t => t.accountId === acc.id && t.result !== 'OPEN');
  let balance = baseBalance;
  closedTrades.forEach(t => { balance += calcPL(t, funded); });

  // Peak equity (máximo balance alcanzado)
  let peak = baseBalance;
  let running = baseBalance;
  [...closedTrades].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).forEach(t => {
    running += calcPL(t, funded);
    if (running > peak) peak = running;
  });

  // DD máximo: desde el capital fondeado (absoluto, como lo hace FTMO)
  const currentDD_dollars = funded - balance;
  const currentDD_pct     = currentDD_dollars / funded * 100;
  const maxDD_used_pct    = Math.max(0, currentDD_pct);

  // DD diario: trades cerrados HOY
  const today = new Date().toISOString().split('T')[0];
  const todayTrades  = closedTrades.filter(t => t.closeDate === today || t.date === today);
  const dailyPL      = todayTrades.reduce((s, t) => s + calcPL(t, funded), 0);
  const dailyDD_used = Math.max(0, -dailyPL);
  const dailyDD_used_pct = dailyDD_used / funded * 100;

  // Ganancia acumulada desde el capital fondeado
  const profit         = balance - funded;
  const profit_pct     = profit / funded * 100;
  const target_used_pct = Math.max(0, profit_pct);

  // Estado del reto
  let status = 'PASANDO';
  let statusColor = '#4ade80';
  if (currentDD_dollars  >= maxDD_limit)   { status = 'FALLADO';    statusColor = 'var(--loss-red)'; }
  else if (dailyDD_used  >= dailyDD_limit)  { status = 'DD DIARIO';  statusColor = 'var(--loss-red)'; }
  else if (profit_pct    >= target_pct)     { status = 'COMPLETADO'; statusColor = 'var(--win-gold)'; }
  else if (maxDD_used_pct  > maxDD_pct  * 0.75) { status = 'EN RIESGO'; statusColor = '#fb923c'; }
  else if (dailyDD_used_pct > dailyDD_pct * 0.75) { status = 'CUIDADO';   statusColor = '#fb923c'; }

  // Estadísticas de consistencia
  const tradingDays  = [...new Set(closedTrades.map(t => t.date))].length;
  const positiveDays = calcPositiveDays(closedTrades, funded);
  const winRate      = closedTrades.length
    ? Math.round(closedTrades.filter(t => t.result === 'WIN').length / closedTrades.length * 100)
    : 0;
  const biggestLoss  = closedTrades.length
    ? Math.min(0, Math.min(...closedTrades.map(t => calcPL(t, funded))))
    : 0;

  // Historial P&L diario (ordenado por fecha)
  const dailyHistory = calcDailyHistory(closedTrades, funded);

  return {
    funded, balance, peak, baseBalance,
    profit, profit_pct, target_pct, target_limit, target_used_pct,
    currentDD_dollars, currentDD_pct, maxDD_pct, maxDD_limit, maxDD_used_pct,
    dailyPL, dailyDD_used, dailyDD_used_pct, dailyDD_pct, dailyDD_limit,
    status, statusColor,
    tradingDays, positiveDays, winRate, biggestLoss,
    dailyHistory,
  };
}

function calcPositiveDays(trades, funded) {
  const byDay = {};
  trades.forEach(t => {
    const d = t.date;
    if (!byDay[d]) byDay[d] = 0;
    byDay[d] += calcPL(t, funded);
  });
  return Object.values(byDay).filter(v => v > 0).length;
}

function calcDailyHistory(trades, funded) {
  const byDay = {};
  trades.forEach(t => {
    const d = t.date;
    if (!byDay[d]) byDay[d] = 0;
    byDay[d] += calcPL(t, funded);
  });
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pl]) => ({ date, pl }));
}

// ── RENDER DEL PANEL ───────────────────────────────────────────────────────

export function renderPropFirmPanel(acc, trades, containerEl) {
  if (!containerEl) return;
  const s = calcPropFirmStatus(acc, trades);
  if (!s) { containerEl.innerHTML = ''; containerEl.classList.add('hidden'); return; }
  containerEl.classList.remove('hidden');

  const fmt    = (v, dec=2) => '$' + Math.abs(v).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const pct    = v => v.toFixed(2) + '%';
  const bar    = (used, total, color) => {
    const w   = Math.min(100, used / total * 100);
    const bgc = w >= 90 ? 'var(--loss-red)' : w >= 70 ? '#fb923c' : color;
    return `<div class="progress-bar"><div class="progress-fill" style="width:${w}%;background:${bgc}"></div></div>`;
  };

  const minDays    = acc.minTradingDays || 0;
  const daysW      = minDays ? Math.min(100, s.tradingDays / minDays * 100) : 0;
  const daysColor  = daysW >= 100 ? '#4ade80' : daysW >= 60 ? '#fb923c' : 'var(--accent-blue)';

  containerEl.innerHTML = `
  <!-- STATUS BADGE -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <div style="font-family:var(--font-ui);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">
        ${acc.brokerName || 'PropFirm'} ${acc.phase ? '· '+acc.phase : ''}
      </div>
      <div style="font-family:var(--font-data);font-size:24px;font-weight:700;
        color:${s.profit >= 0 ? 'var(--win-gold)' : 'var(--loss-red)'};
        text-shadow:0 0 20px ${s.profit >= 0 ? 'rgba(201,168,76,.4)' : 'rgba(232,64,64,.4)'}">
        ${s.profit >= 0 ? '+' : ''}${fmt(s.profit)}
        <span style="font-size:13px;font-weight:500;opacity:.8">(${s.profit >= 0 ? '+' : ''}${pct(s.profit_pct)})</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-data)">Balance: ${fmt(s.balance)}</div>
    </div>
    <div style="text-align:center">
      <div style="background:${s.statusColor}20;border:1px solid ${s.statusColor}50;border-radius:var(--radius-md);padding:6px 12px">
        <div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:${s.statusColor}">${s.status}</div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:4px;font-family:var(--font-data)">${s.tradingDays} días op.</div>
    </div>
  </div>

  <!-- BARRAS DE RIESGO -->
  <div class="space-y-3 mb-4">
    <!-- DD Máximo -->
    <div>
      <div class="flex justify-between mb-1" style="font-size:11px">
        <span style="color:var(--text-secondary)"><i class="fas fa-shield-alt mr-1" style="color:var(--loss-red)"></i>DD Máximo</span>
        <span style="font-family:var(--font-data);font-weight:700;color:${s.maxDD_used_pct >= s.maxDD_pct * .9 ? 'var(--loss-red)' : 'var(--text-primary)'}">
          ${fmt(s.currentDD_dollars)} / ${fmt(s.maxDD_limit)} (${pct(s.maxDD_used_pct)} de ${pct(s.maxDD_pct)})
        </span>
      </div>
      ${bar(s.maxDD_used_pct, s.maxDD_pct, '#ef4444')}
    </div>

    <!-- DD Diario -->
    <div>
      <div class="flex justify-between mb-1" style="font-size:11px">
        <span style="color:var(--text-secondary)"><i class="fas fa-calendar-day mr-1" style="color:#fb923c"></i>DD Diario (hoy)</span>
        <span style="font-family:var(--font-data);font-weight:700;color:${s.dailyDD_used_pct >= s.dailyDD_pct * .9 ? 'var(--loss-red)' : s.dailyPL >= 0 ? 'var(--win-gold)' : 'var(--text-primary)'}">
          ${s.dailyPL >= 0 ? '+' : ''}${fmt(s.dailyPL)} / límite ${fmt(s.dailyDD_limit)}
        </span>
      </div>
      ${bar(s.dailyDD_used_pct, s.dailyDD_pct, '#fb923c')}
    </div>

    <!-- Objetivo -->
    <div>
      <div class="flex justify-between mb-1" style="font-size:11px">
        <span style="color:var(--text-secondary)"><i class="fas fa-trophy mr-1" style="color:var(--win-gold)"></i>Objetivo de ganancia</span>
        <span style="font-family:var(--font-data);font-weight:700;color:${s.profit_pct >= s.target_pct ? 'var(--win-gold)' : 'var(--text-primary)'}">
          ${fmt(s.profit)} / ${fmt(s.target_limit)} (${pct(Math.max(0, s.profit_pct))} de ${pct(s.target_pct)})
        </span>
      </div>
      ${bar(Math.max(0, s.profit_pct), s.target_pct, '#4ade80')}
    </div>

    <!-- Días mínimos (solo si está configurado) -->
    ${minDays ? `
    <div>
      <div class="flex justify-between mb-1" style="font-size:11px">
        <span style="color:var(--text-secondary)"><i class="fas fa-calendar-check mr-1" style="color:${daysColor}"></i>Días de trading</span>
        <span style="font-family:var(--font-data);font-weight:700;color:${daysColor}">
          ${s.tradingDays} / ${minDays} días mínimos ${s.tradingDays >= minDays ? '✓' : ''}
        </span>
      </div>
      ${bar(s.tradingDays, minDays, 'var(--accent-blue)')}
    </div>` : ''}
  </div>

  <!-- ESTADÍSTICAS DE CONSISTENCIA -->
  <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
    <div class="text-label mb-3">Consistencia del reto</div>
    <div class="grid grid-cols-2 gap-2">
      <div class="adv-metric">
        <div class="adv-label">Días positivos</div>
        <div class="adv-val" style="color:#4ade80">${s.positiveDays}<span style="font-size:12px;color:var(--text-muted)">/${s.tradingDays}</span></div>
      </div>
      <div class="adv-metric">
        <div class="adv-label">Win Rate</div>
        <div class="adv-val" style="color:var(--accent-blue)">${s.winRate}%</div>
      </div>
      <div class="adv-metric">
        <div class="adv-label">Mayor pérdida</div>
        <div class="adv-val" style="color:var(--loss-red)">${fmt(s.biggestLoss)}</div>
        <div class="adv-sub">${s.funded > 0 ? (s.biggestLoss / s.funded * 100).toFixed(2) + '% del capital' : ''}</div>
      </div>
      <div class="adv-metric">
        <div class="adv-label">Peak Equity</div>
        <div class="adv-val" style="color:var(--win-gold)">${fmt(s.peak)}</div>
        <div class="adv-sub">+${((s.peak - s.funded) / s.funded * 100).toFixed(2)}%</div>
      </div>
    </div>
  </div>

  <!-- HISTORIAL DD DIARIO -->
  ${s.dailyHistory.length >= 2 ? `
  <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
    <div class="text-label mb-2">P&L Diario del reto</div>
    <div id="propfirmDailyChart" style="height:120px"></div>
  </div>` : ''}

  <!-- REGLAS DEL RETO -->
  <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:4px">
    <div class="flex items-center justify-between mb-3">
      <div class="text-label">Reglas del reto</div>
      <button onclick="window.journal?.openEditAccountModal?.()" style="font-size:10px;color:var(--accent-blue);font-family:var(--font-ui);font-weight:600;padding:2px 8px;border:1px solid rgba(29,107,251,.3);border-radius:4px;background:rgba(29,107,251,.08)">
        <i class="fas fa-pencil-alt mr-1" style="font-size:9px"></i>Editar
      </button>
    </div>
    <div class="space-y-2">
      ${rulesChecklist(acc, s)}
    </div>
    ${acc.challengeNotes ? `
    <div style="margin-top:10px;padding:8px;background:rgba(29,107,251,.06);border:1px solid rgba(29,107,251,.15);border-radius:6px">
      <div style="font-size:10px;font-weight:700;color:var(--accent-blue);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Notas adicionales</div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;white-space:pre-line">${acc.challengeNotes}</div>
    </div>` : ''}
  </div>`;

  // Renderizar gráfico P&L diario si hay datos
  if (s.dailyHistory.length >= 2) {
    setTimeout(() => renderDailyHistoryChart(s, acc), 50);
  }

  // Alertas automáticas (solo 1 vez por sesión por tipo)
  checkAndAlert(s);
}

// ── REGLAS DEL RETO (checklist visual) ─────────────────────────────────────

function rulesChecklist(acc, s) {
  const rules = [
    { label: `DD Máximo: ${acc.maxDD || 10}% ($${(acc.initialCapital * (acc.maxDD || 10) / 100).toFixed(0)})`, icon: 'fa-shield-alt', color: '#ef4444', ok: s.maxDD_used_pct < (acc.maxDD || 10) * 0.75 },
    { label: `DD Diario: ${acc.dailyDD || 5}% ($${(acc.initialCapital * (acc.dailyDD || 5) / 100).toFixed(0)})`, icon: 'fa-calendar-day', color: '#fb923c', ok: s.dailyDD_used_pct < (acc.dailyDD || 5) * 0.75 },
    { label: `Objetivo de ganancia: ${acc.target || 10}% ($${(acc.initialCapital * (acc.target || 10) / 100).toFixed(0)})`, icon: 'fa-bullseye', color: 'var(--win-gold)', ok: s.profit_pct >= (acc.target || 10) },
  ];
  if (acc.minTradingDays) {
    rules.push({ label: `Días mínimos de trading: ${acc.minTradingDays}`, icon: 'fa-calendar-check', color: 'var(--accent-blue)', ok: s.tradingDays >= acc.minTradingDays });
  }
  if (acc.phase) {
    rules.push({ label: `Fase: ${acc.phase}`, icon: 'fa-layer-group', color: '#c4b5fd', ok: true });
  }
  return rules.map(r => `
    <div class="flex items-center gap-2" style="font-size:12px">
      <i class="fas ${r.icon}" style="color:${r.color};font-size:11px;width:14px;text-align:center;flex-shrink:0"></i>
      <span style="color:var(--text-secondary);flex:1">${r.label}</span>
      <i class="fas ${r.ok ? 'fa-check-circle' : 'fa-circle'}" style="color:${r.ok ? '#4ade80' : 'var(--text-muted)'};font-size:11px"></i>
    </div>`).join('');
}

// ── GRÁFICO P&L DIARIO ──────────────────────────────────────────────────────

function renderDailyHistoryChart(s, acc) {
  const el = document.getElementById('propfirmDailyChart');
  if (!el || !window.Plotly) return;

  const dates = s.dailyHistory.map(d => d.date);
  const pls   = s.dailyHistory.map(d => parseFloat(d.pl.toFixed(2)));
  const limit = -(acc.dailyDD || 5) / 100 * acc.initialCapital;

  const bars = {
    x: dates, y: pls, type: 'bar', name: 'P&L diario',
    marker: { color: pls.map(v => v >= 0 ? '#C9A84C' : '#E84040') },
    hovertemplate: '%{x}: $%{y:.2f}<extra></extra>',
  };

  const limitLine = {
    x: [dates[0], dates[dates.length - 1]],
    y: [limit, limit],
    type: 'scatter', mode: 'lines', name: 'Límite DD diario',
    line: { color: '#E84040', width: 1.5, dash: 'dot' },
    hovertemplate: 'Límite DD: $%{y:.2f}<extra></extra>',
  };

  Plotly.newPlot('propfirmDailyChart', [bars, limitLine], {
    showlegend: false,
    margin: { t: 4, b: 28, l: 50, r: 8 },
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#94a3b8', size: 10 },
    xaxis: { tickangle: -30, color: '#94a3b8', tickfont: { size: 9 } },
    yaxis: { color: '#94a3b8', tickprefix: '$' },
    bargap: 0.3,
  }, { displayModeBar: false, responsive: true });
}

// ── ALERTAS ────────────────────────────────────────────────────────────────

const _alerted = new Set();

function checkAndAlert(s) {
  const maxPct = s.maxDD_used_pct / s.maxDD_pct * 100;
  const dayPct = s.dailyDD_used_pct / s.dailyDD_pct * 100;

  if (maxPct >= 90 && !_alerted.has('max90')) {
    _alerted.add('max90');
    showToast(`⛔ DD Máximo al ${maxPct.toFixed(0)}% — ¡Cuidado!`, 'error');
  } else if (maxPct >= 75 && !_alerted.has('max75')) {
    _alerted.add('max75');
    showToast(`⚠️ DD Máximo al ${maxPct.toFixed(0)}% del límite`, 'info');
  }

  if (dayPct >= 90 && !_alerted.has('day90')) {
    _alerted.add('day90');
    showToast(`🔴 DD Diario al ${dayPct.toFixed(0)}% — Considera parar hoy`, 'error');
  } else if (dayPct >= 75 && !_alerted.has('day75')) {
    _alerted.add('day75');
    showToast(`🟡 DD Diario al ${dayPct.toFixed(0)}% del límite`, 'info');
  }

  if (s.status === 'COMPLETADO' && !_alerted.has('done')) {
    _alerted.add('done');
    showToast('🏆 ¡OBJETIVO ALCANZADO! Reto completado', 'success');
  }
}
