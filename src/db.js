/**
 * db.js — Capa de datos con Supabase
 * Cada operación filtra automáticamente por user_id via RLS.
 */
import { supabase } from './lib/supabase.js';

function rowToTrade(r) {
  return {
    id: r.id, accountId: r.account_id, date: r.date, time: r.time,
    pair: r.pair, direction: r.direction, timeframe: r.timeframe,
    session: r.session, strategy: r.strategy, poi: r.poi,
    fibLevel: r.fib_level, trendHTF: r.trend_htf, aligned: r.aligned,
    confluenceDetails: r.confluence_details,
    entryPrice: r.entry_price, slPrice: r.sl_price,
    tpPrice: r.tp_price, closePrice: r.close_price,
    riskType: r.risk_type, riskValue: r.risk_value,
    mentalState: r.mental_state, rulesFollowed: r.rules_followed,
    rulesBreak: r.rules_break, rrPlanned: r.rr_planned,
    result: r.result, rrReal: r.rr_real, lossCause: r.loss_cause,
    ignoredNews: r.ignored_news, closeDate: r.close_date,
    closeTime: r.close_time, notes: r.notes, tags: r.tags || [],
    duration: r.duration, htfTimeframe: r.htf_timeframe,
    checklist: r.checklist || [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function tradeToRow(t, userId) {
  return {
    user_id: userId, account_id: t.accountId,
    date: t.date || null, time: t.time || null,
    pair: t.pair, direction: t.direction, timeframe: t.timeframe,
    session: t.session, strategy: t.strategy, poi: t.poi,
    fib_level: t.fibLevel, trend_htf: t.trendHTF, aligned: t.aligned,
    confluence_details: t.confluenceDetails,
    entry_price: t.entryPrice, sl_price: t.slPrice,
    tp_price: t.tpPrice, close_price: t.closePrice,
    risk_type: t.riskType, risk_value: t.riskValue,
    mental_state: t.mentalState, rules_followed: t.rulesFollowed,
    rules_break: t.rulesBreak, rr_planned: t.rrPlanned,
    result: t.result, rr_real: t.rrReal, loss_cause: t.lossCause,
    ignored_news: t.ignoredNews, close_date: t.closeDate || null,
    close_time: t.closeTime || null, notes: t.notes,
    tags: t.tags || [], duration: t.duration,
    htf_timeframe: t.htfTimeframe || null,
    checklist: t.checklist || [],
    updated_at: new Date().toISOString(),
  };
}

function rowToAccount(r) {
  return {
    id: r.id, name: r.name, initialCapital: r.initial_capital,
    currentCapital: r.current_capital ?? r.initial_capital,
    maxDD: r.max_dd, dailyDD: r.daily_dd, target: r.target,
    riskPerTrade: r.risk_per_trade, color: r.color,
    accountType: r.account_type || 'propfirm',
    brokerName: r.broker_name || '', phase: r.phase || '',
    minTradingDays: r.min_trading_days ?? null,
    challengeNotes: r.challenge_notes ?? '',
    createdAt: r.created_at,
  };
}

function accountToRow(a, userId) {
  return {
    user_id: userId, name: a.name, initial_capital: a.initialCapital,
    current_capital: a.currentCapital ?? a.initialCapital,
    max_dd: a.maxDD || null, daily_dd: a.dailyDD || null,
    target: a.target || null, risk_per_trade: a.riskPerTrade || 1,
    color: a.color || '#3b82f6',
    account_type: a.accountType || 'propfirm',
    broker_name: a.brokerName || null, phase: a.phase || null,
    min_trading_days: a.minTradingDays ? parseInt(a.minTradingDays) : null,
    challenge_notes: a.challengeNotes || null,
  };
}

export async function loadTrades() {
  const { data, error } = await supabase
    .from('trades').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (error) { console.error('loadTrades:', error); return []; }
  return data.map(rowToTrade);
}

export async function saveTrade(trade, userId) {
  const row = tradeToRow(trade, userId);
  if (trade.id && !String(trade.id).match(/^\d+$/)) {
    const { error } = await supabase.from('trades').update(row).eq('id', trade.id);
    if (error) { console.error('updateTrade:', error); return null; }
    return trade;
  } else {
    const { data, error } = await supabase.from('trades').insert(row).select().single();
    if (error) { console.error('insertTrade:', error); return null; }
    return rowToTrade(data);
  }
}

export async function removeTrade(id) {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) console.error('deleteTrade:', error);
}

export async function loadAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at');
  if (error) { console.error('loadAccounts:', error); return []; }
  return data.map(rowToAccount);
}

export async function saveAccount(account, userId) {
  const row = accountToRow(account, userId);
  if (account.id) {
    const { error } = await supabase.from('accounts').update(row).eq('id', account.id);
    if (error) { console.error('updateAccount:', error); return null; }
    return account;
  }
  const { data, error } = await supabase.from('accounts').insert(row).select().single();
  if (error) { console.error('insertAccount:', error); return null; }
  return rowToAccount(data);
}

export async function removeAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) console.error('deleteAccount:', error);
}

export async function loadConfig(userId) {
  const { data } = await supabase.from('user_config').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return { pairs: ['XAUUSD','NAS100','EURUSD','GBPUSD','BTCUSD'], strategies: ['SMC/ICT','Price Action','Tendencia'], setups: ['BPR','OB+FVG','Breaker+FVG','OB+Fib','IFVG+Fib','EMA Bounce'], checklistItems: ['Estructura HTF alcista/bajista confirmada','Hay un POI válido (OB / FVG / BPR)','El precio llegó al POI sin estar extendido','Confluencia Fibonacci 61.8–78.6%','Sin noticias de alto impacto en los próximos 30 min','Riesgo no supera el límite diario'] };
  return { pairs: data.pairs, strategies: data.strategies, setups: data.setups, checklistItems: data.checklist_items || [] };
}

export async function saveConfig(config, userId) {
  const { error } = await supabase.from('user_config').upsert(
    { user_id: userId, pairs: config.pairs, strategies: config.strategies, setups: config.setups, checklist_items: config.checklistItems || [], updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) console.error('saveConfig:', error);
}

export const local = {
  getActiveAccount: () => localStorage.getItem('tj_activeAccount'),
  setActiveAccount: (id) => localStorage.setItem('tj_activeAccount', id),
};

// ── DAILY NOTES ──────────────────────────────────────────────────────────────

export async function loadDailyNotes() {
  const { data, error } = await supabase
    .from('daily_notes').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (error) { console.error('loadDailyNotes:', error); return []; }
  return data.map(r => ({
    id: r.id, date: r.date, session: r.session, mood: r.mood,
    content: r.content, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export async function saveDailyNote(note, userId) {
  const row = { user_id: userId, date: note.date, session: note.session || null, mood: note.mood || null, content: note.content || '', updated_at: new Date().toISOString() };
  if (note.id) {
    const { error } = await supabase.from('daily_notes').update(row).eq('id', note.id);
    if (error) { console.error('updateDailyNote:', error); return null; }
    return note;
  }
  const { data, error } = await supabase.from('daily_notes').insert(row).select().single();
  if (error) { console.error('insertDailyNote:', error); return null; }
  return { id: data.id, date: data.date, session: data.session, mood: data.mood, content: data.content, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function removeDailyNote(id) {
  const { error } = await supabase.from('daily_notes').delete().eq('id', id);
  if (error) console.error('deleteDailyNote:', error);
}
