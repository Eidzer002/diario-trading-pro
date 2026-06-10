/**
 * TradingJournal.js — Clase principal (async con Supabase)
 */
import { local, loadTrades, loadAccounts, loadConfig, saveConfig, saveAccount, removeAccount, loadDailyNotes, saveDailyNote, removeDailyNote } from '../db.js';
import { showToast, openModal, closeModal }  from '../utils/helpers.js';
import { calcPL }                            from '../utils/calculations.js';
import { renderDashboard, initCalendar, renderCalendar } from './dashboard.js';
import { renderAnalysis }   from './analysis.js';
import { renderPsychology } from './psychology.js';
import { setupTradeForm, setupLotCalculator, openTradeModal, closeTradeModal,
         renderTrades, applyFilters, clearFilters, setupTagInput } from './tradeForm.js';
import { setupChecklist, renderChecklistConfig, setupChecklistConfig } from './checklist.js';
import { setupDailyNotes, renderDailyNotes, editDailyNote } from './dailyNotes.js';

export class TradingJournal {
  constructor(userId) {
    this.userId         = userId;
    this.trades         = [];
    this.accounts       = [];
    this.config         = { pairs: [], strategies: [], setups: [], checklistItems: [] };
    this.dailyNotes     = [];
    this.activeAccount  = local.getActiveAccount();
    this.editTradeId    = null;
    this.filteredTrades = [];
    this._calDate       = new Date();
    this._weekOffset    = 0;
  }

  // ── INIT (async) ──────────────────────────────────────────────────────
  async init() {
    // Cargar datos del usuario desde Supabase
    const [trades, accounts, config, dailyNotes] = await Promise.all([
      loadTrades(),
      loadAccounts(),
      loadConfig(this.userId),
      loadDailyNotes(),
    ]);
    this.trades      = trades;
    this.accounts    = accounts;
    this.config      = config;
    this.dailyNotes  = dailyNotes;
    this.filteredTrades = [...this.trades];

    // Validar activeAccount
    if (!this.activeAccount || !this.accounts.find(a => a.id === this.activeAccount)) {
      this.activeAccount = this.accounts.length ? this.accounts[0].id : null;
      if (this.activeAccount) local.setActiveAccount(this.activeAccount);
    }

    this.setupNav();
    this.setupAccountForm();
    setupTradeForm(this);
    this.setupConfigListeners();
    setupLotCalculator(this);
    setupTagInput(this);
    setupChecklist(this);
    setupDailyNotes(this);
    setupChecklistConfig(this);
    initCalendar(this);
    this.populateAccountSelector();

    // Exponer métodos necesarios para onclick inline
    window.journal = this;
    window.journal.editDailyNote    = (id) => { editDailyNote(this, id); };
    window.journal.removeChecklistItem = (idx) => this.removeChecklistItem(idx);

    if (!this.accounts.length) {
      setTimeout(() => openModal('setupModal'), 400);
    } else {
      this.renderDashboard();
      this.renderTrades();
    }
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────
  setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn =>
      btn.addEventListener('click', () => this.showSection(btn.dataset.section))
    );
    const sel = document.getElementById('accountSelector');
    if (sel) sel.addEventListener('change', e => {
      this.activeAccount = e.target.value;
      local.setActiveAccount(this.activeAccount);
      this.renderDashboard();
      this.renderTrades();
    });
  }

  showSection(name) {
    document.querySelectorAll('.spa-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + name)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
    ({ dashboard: () => this.renderDashboard(), analisis: () => this.renderAnalysis(),
       config: () => this.renderConfig(), registro: () => this.renderTrades(),
       psicologia: () => this.renderPsychology(), notas: () => this.renderDailyNotes() })[name]?.();
  }

  // ── DELEGATION ────────────────────────────────────────────────────────
  renderDashboard()  { renderDashboard(this); }
  renderAnalysis()   { renderAnalysis(this); }
  renderPsychology() { renderPsychology(this); }
  renderTrades()     { renderTrades(this); }
  renderCalendar()   { renderCalendar(this); }
  renderDailyNotes() { renderDailyNotes(this); }

  openTradeModal(id = null) { openTradeModal(this, id); }
  closeTradeModal()          { closeTradeModal(this); }
  applyFilters()             { applyFilters(this); }
  clearFilters()             { clearFilters(this); }

  async deleteTrade(id) {
    if (!confirm('¿Eliminar esta operación?')) return;
    const { removeTrade } = await import('../db.js');
    await removeTrade(id);
    this.trades         = this.trades.filter(t => t.id !== id);
    this.filteredTrades = this.filteredTrades.filter(t => t.id !== id);
    this.renderTrades(); this.renderDashboard();
    showToast('Eliminada', 'info');
  }

  // ── ACCOUNTS ──────────────────────────────────────────────────────────
  setupAccountForm() {
    const handleSubmit = async (nameId, capId, maxDDId, targetId, riskId, colorId, modalId) => {
      const name = document.getElementById(nameId)?.value.trim();
      const cap  = parseFloat(document.getElementById(capId)?.value) || 0;
      if (!name || cap <= 0) { showToast('Completa los campos requeridos', 'error'); return; }
      const acc = await this.createAccount({
        name, initialCapital: cap,
        maxDD:        parseFloat(document.getElementById(maxDDId)?.value)  || 8,
        target:       parseFloat(document.getElementById(targetId)?.value) || 10,
        riskPerTrade: parseFloat(document.getElementById(riskId)?.value)   || 1,
        color:        document.getElementById(colorId)?.value || '#3b82f6',
      });
      if (acc) { closeModal(modalId); showToast('Cuenta creada'); this.renderDashboard(); }
    };

    document.getElementById('setupForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      await handleSubmit('setupAccountName','setupCapital','setupMaxDD','setupTarget','setupRisk','naColor','setupModal');
    });
    document.getElementById('newAccountForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      await handleSubmit('naName','naCapital','naMaxDD','naTarget','naRisk','naColor','newAccountModal');
      document.getElementById('newAccountForm')?.reset(); this.renderConfig();
    });
    document.querySelectorAll('.color-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.style.borderColor = 'transparent');
        opt.style.borderColor = '#fff';
        const nc = document.getElementById('naColor'); if (nc) nc.value = opt.dataset.color;
      });
    });
  }

  async createAccount(data) {
    const acc = await saveAccount({ name: data.name, initialCapital: data.initialCapital, maxDD: data.maxDD || 8, target: data.target || 10, riskPerTrade: data.riskPerTrade || 1, color: data.color || '#3b82f6' }, this.userId);
    if (!acc) return null;
    this.accounts.push(acc);
    if (!this.activeAccount) { this.activeAccount = acc.id; local.setActiveAccount(acc.id); }
    this.populateAccountSelector();
    return acc;
  }

  getAccountById(id)     { return this.accounts.find(a => a.id === id); }
  calcPL(trade, capital) { return calcPL(trade, capital); }

  getAccountBalance(accountId) {
    const acc = this.getAccountById(accountId); if (!acc) return 0;
    return this.trades
      .filter(t => t.accountId === accountId && t.result !== 'OPEN')
      .reduce((b, t) => b + calcPL(t, acc.initialCapital), acc.initialCapital);
  }

  async deleteAccount(id) {
    const count = this.trades.filter(t => t.accountId === id).length;
    if (count > 0 && !confirm(`Esta cuenta tiene ${count} operaciones. ¿Eliminar?`)) return;
    await removeAccount(id);
    this.accounts = this.accounts.filter(a => a.id !== id);
    if (this.activeAccount === id) {
      this.activeAccount = this.accounts.length ? this.accounts[0].id : null;
      local.setActiveAccount(this.activeAccount);
    }
    this.populateAccountSelector(); this.renderConfig(); this.renderDashboard();
    showToast('Cuenta eliminada', 'info');
  }

  populateAccountSelector() {
    const opts = this.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    const set = (id, prefix = '') => { const el = document.getElementById(id); if (el) { el.innerHTML = prefix + opts; if (this.activeAccount) el.value = this.activeAccount; } };
    set('accountSelector'); set('filterAccount', '<option value="">Todas</option>'); set('tradeAccount');
  }

  populateTradeSelects() {
    const el = (id) => document.getElementById(id);
    if (el('tradePOI'))   el('tradePOI').innerHTML   = '<option value="">-</option>' + this.config.setups.map(s => `<option value="${s}">${s}</option>`).join('');
    if (el('tradeStrategy')) el('tradeStrategy').innerHTML = '<option value="">-</option>' + this.config.strategies.map(s => `<option value="${s}">${s}</option>`).join('');
    if (el('pairSuggestions')) el('pairSuggestions').innerHTML = this.config.pairs.map(p => `<option value="${p}">`).join('');
  }

  // ── CONFIG ────────────────────────────────────────────────────────────
  setupConfigListeners() {
    const addItem = (btnId, inputId, key) => {
      document.getElementById(btnId)?.addEventListener('click', async () => {
        const input = document.getElementById(inputId);
        const v = (key === 'pairs' ? input?.value.trim().toUpperCase() : input?.value.trim());
        if (v && !this.config[key].includes(v)) {
          this.config[key].push(v); await saveConfig(this.config, this.userId);
          this.renderConfig(); if (input) input.value = '';
        }
      });
    };
    addItem('addPairBtn',     'newPairInput',     'pairs');
    addItem('addStrategyBtn', 'newStrategyInput', 'strategies');
    addItem('addSetupBtn',    'newSetupInput',    'setups');

    document.getElementById('exportBtn')?.addEventListener('click',       () => this.exportCSV());
    document.getElementById('exportJsonBtn')?.addEventListener('click',   () => this.exportJSON());
    document.getElementById('importJsonBtn')?.addEventListener('click',   () => document.getElementById('importJsonInput')?.click());
    document.getElementById('importJsonInput')?.addEventListener('change', e => this.importJSON(e));
    document.getElementById('resetAllBtn')?.addEventListener('click',     () => { if (confirm('¿Borrar TODOS tus datos?')) this.resetUserData(); });
    document.getElementById('toggleFilters')?.addEventListener('click',   () => {
      const fp = document.getElementById('filterPanel'); if (!fp) return;
      const h = fp.classList.toggle('hidden');
      const btn = document.getElementById('toggleFilters'); if (btn) btn.textContent = h ? 'Mostrar' : 'Ocultar';
    });
    document.getElementById('applyFilters')?.addEventListener('click',   () => this.applyFilters());
    document.getElementById('clearFilters')?.addEventListener('click',   () => this.clearFilters());
  }

  renderConfig() {
    const al = document.getElementById('accountsList');
    if (al) al.innerHTML = !this.accounts.length
      ? '<p class="text-xs text-slate-500">No hay cuentas.</p>'
      : this.accounts.map(a => {
          const bal = this.getAccountBalance(a.id), pnl = bal - a.initialCapital, pct = pnl / a.initialCapital * 100;
          return `<div class="glass-effect p-3 flex items-center justify-between">
            <div class="flex items-center gap-3"><div class="w-3 h-3 rounded-full" style="background:${a.color}"></div>
            <div><div class="font-semibold text-white text-sm">${a.name}</div>
            <div class="text-xs text-slate-400">$${a.initialCapital.toLocaleString('en')} · DD ${a.maxDD}% · Obj ${a.target}%</div></div></div>
            <div class="text-right"><div class="font-semibold text-sm" style="color:${pnl >= 0 ? '#22c55e' : '#ef4444'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>
            <button onclick="window.journal.deleteAccount('${a.id}')" class="text-xs text-red-400 mt-1 block">Eliminar</button></div>
          </div>`;
        }).join('');
    this.renderTags('pairTagsContainer',     this.config.pairs,      'pairs');
    this.renderTags('strategyTagsContainer', this.config.strategies, 'strategies');
    this.renderTags('setupTagsContainer',    this.config.setups,     'setups');
    renderChecklistConfig(this);
  }

  renderTags(id, items, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map((item, i) =>
      `<span class="config-tag">${item}<span class="remove" onclick="window.journal.removeConfigItem('${type}',${i})">✕</span></span>`
    ).join('');
  }

  async removeConfigItem(type, idx) {
    this.config[type].splice(idx, 1);
    await saveConfig(this.config, this.userId);
    this.renderConfig();
  }

  async resetUserData() {
    const { removeTrade, removeAccount } = await import('../db.js');
    await Promise.all(this.trades.map(t => removeTrade(t.id)));
    await Promise.all(this.accounts.map(a => removeAccount(a.id)));
    this.trades = []; this.accounts = []; this.filteredTrades = []; this.activeAccount = null;
    local.setActiveAccount(null);
    this.populateAccountSelector(); this.renderDashboard(); this.renderTrades(); this.renderConfig();
    showToast('Datos eliminados', 'info');
  }

  async removeChecklistItem(idx) {
    this.config.checklistItems.splice(idx, 1);
    await saveConfig(this.config, this.userId);
    renderChecklistConfig(this);
  }

  // ── DAILY NOTES ───────────────────────────────────────────────────────
  async saveDailyNote(note) {
    const saved = await saveDailyNote(note, this.userId);
    if (!saved) return;
    if (note.id) {
      const idx = this.dailyNotes.findIndex(n => n.id === note.id);
      if (idx >= 0) this.dailyNotes[idx] = saved;
    } else {
      this.dailyNotes.unshift(saved);
    }
    return saved;
  }

  async deleteDailyNote(id) {
    if (!confirm('¿Eliminar esta nota?')) return;
    await removeDailyNote(id);
    this.dailyNotes = this.dailyNotes.filter(n => n.id !== id);
    renderDailyNotes(this);
    showToast('Nota eliminada', 'info');
  }

  // ── EXPORT / IMPORT ───────────────────────────────────────────────────
  exportCSV() {
    if (!this.trades.length) { showToast('Sin datos', 'error'); return; }
    const h = ['Cuenta','Fecha','Hora','Activo','Dir','TF','Sesión','Estrategia','Setup','Fib','Entrada','SL','TP','Cierre','Duración(min)','Riesgo','Tipo','Resultado','RR Plan','RR Real','PnL','Mental','Reglas','Causa LOSS','Tags','Notas'];
    const rows = this.trades.map(t => {
      const a = this.getAccountById(t.accountId), pl = a ? calcPL(t, a.initialCapital) : 0;
      return [a?.name||'?',t.date,t.time,t.pair,t.direction,t.timeframe,t.session,t.strategy,t.poi,t.fibLevel,t.entryPrice||'',t.slPrice||'',t.tpPrice||'',t.closePrice||'',t.duration||'',t.riskValue,t.riskType,t.result,t.rrPlanned,t.rrReal,pl.toFixed(2),t.mentalState,t.rulesFollowed,t.lossCause,(t.tags||[]).join(';'),t.notes].map(v => `"${v||''}"`);
    });
    const csv = [h, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `diario_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    showToast('CSV exportado ✓');
  }

  exportJSON() {
    const data = { trades: this.trades, accounts: this.accounts, config: this.config, exportedAt: new Date().toISOString() };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
    showToast('Backup creado ✓');
  }

  importJSON(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.trades || !data.accounts) { showToast('Archivo inválido', 'error'); return; }
        if (!confirm(`¿Restaurar ${data.trades.length} operaciones?`)) return;
        showToast('Importando...', 'info');
        const { saveTrade, saveAccount: sa } = await import('../db.js');
        for (const a of data.accounts) { delete a.id; await sa(a, this.userId); }
        this.accounts = await loadAccounts();
        for (const t of data.trades) { delete t.id; await saveTrade(t, this.userId); }
        this.trades = await loadTrades();
        this.filteredTrades = [...this.trades]; if (this.accounts.length) this.activeAccount = this.accounts[0].id;
        this.populateAccountSelector(); this.renderDashboard(); this.renderTrades(); this.renderConfig();
        showToast(`Restaurado: ${this.trades.length} operaciones ✓`);
      } catch { showToast('Error al leer el archivo', 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
  }
}
