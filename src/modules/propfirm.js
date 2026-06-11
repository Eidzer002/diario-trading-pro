/**
 * propfirm.js — Panel de seguimiento para cuentas PropFirm (v4.5)
 *
 * Calcula y muestra en tiempo real:
 * - DD máximo actual vs límite
 * - DD diario actual vs límite
 * - Progreso hacia el objetivo de ganancia
 * - Peak equity (para DD trailing)
 * - Status del reto: PASANDO / EN RIESGO / FALLADO / COMPLETADO
 * - Estadísticas de consistencia
 * - Alertas automáticas cuando se acercan los límites
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

  return {
    funded, balance, peak, baseBalance,
    profit, profit_pct, target_pct, target_limit, target_used_pct,
    currentDD_dollars, currentDD_pct, maxDD_pct, maxDD_limit, maxDD_used_pct,
    dailyPL, dailyDD_used, dailyDD_used_pct, dailyDD_pct, dailyDD_limit,
    status, statusColor,
    tradingDays, positiveDays, winRate, biggestLoss,
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
  </div>

  <!-- ESTADÍSTICAS DE CONSISTENCIA -->
  <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
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
  </div>`;

  // Alertas automáticas (solo 1 vez por sesión por tipo)
  checkAndAlert(s);
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
