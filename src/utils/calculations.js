/**
 * calculations.js — Funciones de cálculo puras
 * Sin efectos secundarios. Fáciles de testear.
 */

/**
 * Calcula el P&L en dólares de un trade.
 * @param {Object} trade
 * @param {number} initialCapital  Capital inicial de la cuenta
 * @returns {number}
 */
export function calcPL(trade, initialCapital) {
  if (!trade.riskValue) return 0;
  const risk = trade.riskType === 'percentage'
    ? (initialCapital * trade.riskValue / 100)
    : parseFloat(trade.riskValue) || 0;
  if (trade.result === 'WIN')  return risk * (parseFloat(trade.rrReal) || parseFloat(trade.rrPlanned) || 1);
  if (trade.result === 'LOSS') return -risk;
  return 0;
}

/**
 * Obtiene la duración de un trade en minutos.
 * Lee el campo guardado o lo calcula desde fechas/horas.
 * @param {Object} t  Trade object
 * @returns {number|null}
 */
export function getTradeDuration(t) {
  if (t.duration && t.duration > 0) return t.duration;
  if (t.date && t.time && t.closeDate && t.closeTime) {
    const diff = new Date(`${t.closeDate}T${t.closeTime}`) - new Date(`${t.date}T${t.time}`);
    if (diff > 0) return Math.round(diff / 60000);
  }
  return null;
}

/**
 * Formatea minutos como string legible ("2h 15m" o "45m").
 * @param {number} min
 * @returns {string}
 */
export function fmtDur(min) {
  if (!min || min <= 0) return '-';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
