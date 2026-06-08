/**
 * TradingJournal.js — Clase principal
 * Gestiona el estado de la app y delega el rendering a los módulos.
 */
import { DB }                  from '../db.js';
import { showToast, openModal, closeModal } from '../utils/helpers.js';
import { calcPL }              from '../utils/calculations.js';
import { renderDashboard, renderAdvancedMetrics, renderMultiAccountTabs, initCalendar, renderCalendar } from './dashboard.js';
import { renderAnalysis }      from './analysis.js';
import { renderPsychology }    from './psychology.js';
import { setupTradeForm, setupLotCalculator, openTradeModal, closeTradeModal, fillTradeForm, saveTradeFromForm, deleteTrade, renderTrades, applyFilters, clearFilters, setupTagInput } from './tradeForm.js';

export class TradingJournal {
  constructor() {
    this.trades         = DB.load('tj_trades', []);
    this.accounts       = DB.load('tj_accounts', []);
    this.config         = DB.load('tj_config', {
      pairs:      ['XAUUSD', 'NAS100', 'EURUSD', 'GBPUSD', 'BTCUSD'],
      strategies: ['SMC/ICT', 'Price Action', 'Tendencia'],
      setups:     ['BPR', 'OB+FVG', 'Breaker+FVG', 'OB+Fib', 'IFVG+Fib', 'EMA Bounce', 'Soporte/Resistencia'],
    });
    this.activeAccount  = DB.load('tj_activeAccount', null);
    this.editTradeId    = null;
    this.filteredTrades = [...this.trades];
    this._calDate       = new Date();
    this._weekOffset    = 0;
    this.init();
  }

  // ── INIT ──────────────────────────────────────────────────────────────
  init() {
    this.setupNav();
    this.setupAccountForm();
    setupTradeForm(this);
    this.setupConfigListeners();
    setupLotCalculator(this);
    setupTagInput(this);
    initCalendar(this);
    this.populateAccountSelector();

    if (this.accounts.length === 0) {
      setTimeout(() => openModal('setupModal'), 400);
    } else {
      if (!this.activeAccount || !this.accounts.find(a => a.id === this.activeAccount)) {
        this.activeAccount = this.accounts[0].id;
        DB.save('tj_activeAccount', this.activeAccount);
      }
      this.renderDashboard();
      this.renderTrades();
    }
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────
  setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.showSection(btn.dataset.section));
    });
    const sel = document.getElementById('accountSelector');
    if (sel) sel.addEventListener('change', e => {
      this.activeAccount = e.target.value;
      DB.save('tj_activeAccount', this.activeAccount);
      this.renderDashboard();
      this.renderTrades();
    });
  }

  showSection(name) {
    document.querySelectorAll('.spa-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + name)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
    const renders = {
      dashboard:  () => this.renderDashboard(),
      analisis:   () => this.renderAnalysis(),
      config:     () => this.renderConfig(),
      registro:   () => this.renderTrades(),
      psicologia: () => this.renderPsychology(),
    };
    renders[name]?.();
  }

  // ── DELEGATION → módulos ──────────────────────────────────────────────
  renderDashboard()  { renderDashboard(this); }
  renderAnalysis()   { renderAnalysis(this); }
  renderPsychology() { renderPsychology(this); }
  renderTrades()     { renderTrades(this); }
  renderCalendar()   { renderCalendar(this); }

  openTradeModal(id = null) { openTradeModal(this, id); }
  closeTradeModal()          { closeTradeModal(this); }
  deleteTrade(id)            { deleteTrade(this, id); }
  applyFilters()             { applyFilters(this); }
  clearFilters()             { clearFilters(this); }

  // ── ACCOUNTS ──────────────────────────────────────────────────────────
  setupAccountForm() {
    document.getElementById('setupForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('setupAccountName').value.trim();
      const cap  = parseFloat(document.getElementById('setupCapital').value) || 0;
      if (!name || cap <= 0) { showToast('Completa los campos requeridos', 'error'); return; }
      this.createAccount({ name, capital: cap, maxDD: parseFloat(document.getElementById('setupMaxDD').value) || 8, target: parseFloat(document.getElementById('setupTarget').value) || 10, riskPerTrade: parseFloat(document.getElementById('setupRisk').value) || 1, color: '#3b82f6' });
      closeModal('setupModal'); showToast('Cuenta creada'); this.renderDashboard();
    });
    document.getElementById('newAccountForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('naName').value.trim();
      const cap  = parseFloat(document.getElementById('naCapital').value) || 0;
      if (!name || cap <= 0) { showToast('Completa los campos requeridos', 'error'); return; }
      this.createAccount({ name, capital: cap, maxDD: parseFloat(document.getElementById('naMaxDD').value) || 8, target: parseFloat(document.getElementById('naTarget').value) || 10, riskPerTrade: parseFloat(document.getElementById('naRisk').value) || 1, color: document.getElementById('naColor').value || '#3b82f6' });
      closeModal('newAccountModal'); document.getElementById('newAccountForm').reset(); showToast('Cuenta creada'); this.renderConfig();
    });
    document.querySelectorAll('.color-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.style.borderColor = 'transparent');
        opt.style.borderColor = '#fff';
        const nc = document.getElementById('naColor'); if (nc) nc.value = opt.dataset.color;
      });
    });
  }

  createAccount(data) {
    const acc = { id: Date.now().toString(), name: data.name, initialCapital: data.capital, maxDD: data.maxDD || 8, target: data.target || 10, riskPerTrade: data.riskPerTrade || 1, color: data.color || '#3b82f6', createdAt: new Date().toISOString() };
    this.accounts.push(acc);
    DB.save('tj_accounts', this.accounts);
    if (!this.activeAccount) { this.activeAccount = acc.id; DB.save('tj_activeAccount', acc.id); }
    this.populateAccountSelector();
    return acc;
  }

  getAccountById(id) { return this.accounts.find(a => a.id === id); }

  getAccountBalance(accountId) {
    const acc = this.getAccountById(accountId); if (!acc) return 0;
    let bal = acc.initialCapital;
    this.trades.filter(t => t.accountId === accountId && t.result !== 'OPEN').forEach(t => { bal += calcPL(t, acc.initialCapital); });
    return bal;
  }

  calcPL(trade, initialCapital) { return calcPL(trade, initialCapital); }

  populateAccountSelector() {
    const sel   = document.getElementById('accountSelector');
    const fAcc  = document.getElementById('filterAccount');
    const trAcc = document.getElementById('tradeAccount');
    const opts  = this.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    if (sel)  { sel.innerHTML  = opts; if (this.activeAccount) sel.value = this.activeAccount; }
    if (fAcc) { fAcc.innerHTML = '<option value="">Todas</option>' + opts; }
    if (trAcc){ trAcc.innerHTML = opts; if (this.activeAccount) trAcc.value = this.activeAccount; }
  }

  populateTradeSelects() {
    const poi   = document.getElementById('tradePOI');
    const strat = document.getElementById('tradeStrategy');
    const pairs = document.getElementById('pairSuggestions');
    if (poi)   poi.innerHTML   = '<option value="">-</option>' + this.config.setups.map(s => `<option value="${s}">${s}</option>`).join('');
    if (strat) strat.innerHTML = '<option value="">-</option>' + this.config.strategies.map(s => `<option value="${s}">${s}</option>`).join('');
    if (pairs) pairs.innerHTML = this.config.pairs.map(p => `<option value="${p}">`).join('');
  }

  deleteAccount(id) {
    const t = this.trades.filter(t => t.accountId === id).length;
    if (t > 0 && !confirm(`Esta cuenta tiene ${t} operaciones. ¿Eliminar?`)) return;
    this.accounts = this.accounts.filter(a => a.id !== id);
    DB.save('tj_accounts', this.accounts);
    if (this.activeAccount === id) { this.activeAccount = this.accounts.length ? this.accounts[0].id : null; DB.save('tj_activeAccount', this.activeAccount); }
    this.populateAccountSelector(); this.renderConfig(); this.renderDashboard();
    showToast('Cuenta eliminada', 'info');
  }

  // ── CONFIG ────────────────────────────────────────────────────────────
  setupConfigListeners() {
    document.getElementById('addPairBtn')?.addEventListener('click',     () => { const v = document.getElementById('newPairInput')?.value.trim().toUpperCase();    if (v && !this.config.pairs.includes(v))      { this.config.pairs.push(v);      this.saveConfig(); this.renderConfig(); document.getElementById('newPairInput').value = ''; } });
    document.getElementById('addStrategyBtn')?.addEventListener('click', () => { const v = document.getElementById('newStrategyInput')?.value.trim();              if (v && !this.config.strategies.includes(v)) { this.config.strategies.push(v);  this.saveConfig(); this.renderConfig(); document.getElementById('newStrategyInput').value = ''; } });
    document.getElementById('addSetupBtn')?.addEventListener('click',    () => { const v = document.getElementById('newSetupInput')?.value.trim();                 if (v && !this.config.setups.includes(v))    { this.config.setups.push(v);     this.saveConfig(); this.renderConfig(); document.getElementById('newSetupInput').value = ''; } });
    document.getElementById('exportBtn')?.addEventListener('click',      () => this.exportCSV());
    document.getElementById('exportJsonBtn')?.addEventListener('click',  () => this.exportJSON());
    document.getElementById('importJsonBtn')?.addEventListener('click',  () => document.getElementById('importJsonInput')?.click());
    document.getElementById('importJsonInput')?.addEventListener('change', e => this.importJSON(e));
    document.getElementById('resetAllBtn')?.addEventListener('click',    () => { if (confirm('¿Borrar TODOS los datos? No se puede deshacer.')) { localStorage.clear(); location.reload(); } });
    document.getElementById('toggleFilters')?.addEventListener('click',  () => { const fp = document.getElementById('filterPanel'); if (!fp) return; const h = fp.classList.toggle('hidden'); const btn = document.getElementById('toggleFilters'); if (btn) btn.textContent = h ? 'Mostrar' : 'Ocultar'; });
    document.getElementById('applyFilters')?.addEventListener('click',   () => this.applyFilters());
    document.getElementById('clearFilters')?.addEventListener('click',   () => this.clearFilters());
  }

  saveConfig() { DB.save('tj_config', this.config); }

  renderConfig() {
    const al = document.getElementById('accountsList');
    if (al) al.innerHTML = !this.accounts.length ? '<p class="text-xs text-slate-500">No hay cuentas.</p>' : this.accounts.map(a => {
      const bal = this.getAccountBalance(a.id); const pnl = bal - a.initialCapital; const pct = pnl / a.initialCapital * 100;
      return `<div class="glass-effect p-3 flex items-center justify-between">
        <div class="flex items-center gap-3"><div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${a.color}"></div>
        <div><div class="font-semibold text-white text-sm">${a.name}</div><div class="text-xs text-slate-400">$${a.initialCapital.toLocaleString('en')} · DD ${a.maxDD}% · Obj ${a.target}%</div></div></div>
        <div class="text-right"><div class="font-semibold text-sm" style="color:${pnl >= 0 ? '#22c55e' : '#ef4444'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>
        <button onclick="window.journal.deleteAccount('${a.id}')" class="text-xs text-red-400 mt-1 block">Eliminar</button></div>
      </div>`;
    }).join('');
    this.renderTags('pairTagsContainer',     this.config.pairs,      'pairs');
    this.renderTags('strategyTagsContainer', this.config.strategies, 'strategies');
    this.renderTags('setupTagsContainer',    this.config.setups,     'setups');
  }

  renderTags(id, items, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map((item, i) => `<span class="config-tag">${item}<span class="remove" onclick="window.journal.removeConfigItem('${type}',${i})">✕</span></span>`).join('');
  }

  removeConfigItem(type, idx) { this.config[type].splice(idx, 1); this.saveConfig(); this.renderConfig(); }

  // ── EXPORT / IMPORT ───────────────────────────────────────────────────
  exportCSV() {
    if (!this.trades.length) { showToast('Sin datos', 'error'); return; }
    const h = ['Cuenta','Fecha','Hora','Activo','Dir','TF','Sesión','Estrategia','Setup','Fib','Entrada','SL','TP','Cierre','Duración(min)','Riesgo','Tipo','Resultado','RR Plan','RR Real','PnL','Mental','Reglas','Causa LOSS','Tags','Notas'];
    const rows = this.trades.map(t => {
      const a = this.getAccountById(t.accountId); const pl = a ? calcPL(t, a.initialCapital) : 0;
      return [a?.name||'?',t.date,t.time,t.pair,t.direction,t.timeframe,t.session,t.strategy,t.poi,t.fibLevel,t.entryPrice||'',t.slPrice||'',t.tpPrice||'',t.closePrice||'',t.duration||'',t.riskValue,t.riskType,t.result,t.rrPlanned,t.rrReal,pl.toFixed(2),t.mentalState,t.rulesFollowed,t.lossCause,(t.tags||[]).join(';'),t.notes].map(v => `"${v||''}"`);
    });
    const csv = [h, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `diario_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    showToast('CSV exportado ✓');
  }

  exportJSON() {
    const data = { trades: this.trades, accounts: this.accounts, config: this.config, exportedAt: new Date().toISOString() };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `backup_diario_${new Date().toISOString().split('T')[0]}.json`; a.click();
    showToast('Backup creado ✓');
  }

  importJSON(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.trades || !data.accounts) { showToast('Archivo inválido', 'error'); return; }
        if (!confirm(`¿Restaurar? Se reemplazarán ${this.trades.length} operaciones actuales.`)) return;
        this.trades = data.trades || []; this.accounts = data.accounts || []; this.config = data.config || this.config;
        DB.save('tj_trades', this.trades); DB.save('tj_accounts', this.accounts); DB.save('tj_config', this.config);
        this.filteredTrades = [...this.trades]; if (this.accounts.length) this.activeAccount = this.accounts[0].id;
        this.populateAccountSelector(); this.renderDashboard(); this.renderTrades(); this.renderConfig();
        showToast(`Restaurado: ${this.trades.length} operaciones ✓`);
      } catch { showToast('Error al leer el archivo', 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
  }
}
