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
    this.setupEditAccountForm();
    initCalendar(this);
    this.populateAccountSelector();

    // Exponer métodos necesarios para onclick inline
    window.journal = this;
    window.journal.editDailyNote       = (id) => { editDailyNote(this, id); };
    window.journal.removeChecklistItem = (idx) => this.removeChecklistItem(idx);
    window.journal.openEditAccountModal = (id) => this.openEditAccountModal(id);

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
    // ── STEP 1: selección de tipo ─────────────────────────────────────
    const show = (id) => {
      ['setupStep1','setupFormReal','setupFormPropfirm'].forEach(s => {
        document.getElementById(s)?.classList.add('hidden');
      });
      document.getElementById(id)?.classList.remove('hidden');
    };

    document.getElementById('chooseReal')?.addEventListener('click', () => show('setupFormReal'));
    document.getElementById('choosePropfirm')?.addEventListener('click', () => show('setupFormPropfirm'));
    document.getElementById('backToStep1Real')?.addEventListener('click', () => show('setupStep1'));
    document.getElementById('backToStep1Propfirm')?.addEventListener('click', () => show('setupStep1'));

    // ── Color pickers (setup modal + new account modal) ───────────────
    const bindColorPicker = (pickerId, hiddenId) => {
      document.getElementById(pickerId)?.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          document.getElementById(pickerId)?.querySelectorAll('.color-opt')
            .forEach(o => o.style.borderColor = 'transparent');
          opt.style.borderColor = '#fff';
          const el = document.getElementById(hiddenId); if (el) el.value = opt.dataset.color;
        });
      });
      // seleccionar el primero por defecto
      const first = document.getElementById(pickerId)?.querySelector('.color-opt');
      if (first) { first.style.borderColor = '#fff'; }
    };
    bindColorPicker('realColorPicker', 'realColor');
    bindColorPicker('pfColorPicker', 'pfColor');
    bindColorPicker('naColorPicker', 'naColor');

    // ── REAL: cálculo en tiempo real ───── (ninguno — es simple)

    // ── PROPFIRM: calcular $ equivalentes live ────────────────────────
    const updatePFCalc = () => {
      const cap    = parseFloat(document.getElementById('pfCapital')?.value) || 0;
      const maxDD  = parseFloat(document.getElementById('pfMaxDD')?.value)   || 0;
      const dailyDD= parseFloat(document.getElementById('pfDailyDD')?.value) || 0;
      const target = parseFloat(document.getElementById('pfTarget')?.value)  || 0;
      const info   = document.getElementById('pfCalcInfo');
      if (!info) return;
      if (cap > 0) {
        info.classList.remove('hidden');
        const fmt = v => '$' + v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('pfMaxDDDollar').textContent    = fmt(cap * maxDD / 100);
        document.getElementById('pfDailyDDDollar').textContent  = fmt(cap * dailyDD / 100);
        document.getElementById('pfTargetDollar').textContent   = fmt(cap * target / 100);
      } else {
        info.classList.add('hidden');
      }
    };
    ['pfCapital','pfMaxDD','pfDailyDD','pfTarget'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', updatePFCalc)
    );

    // ── SUBMIT: Cuenta Real ───────────────────────────────────────────
    document.getElementById('setupFormRealForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('realName')?.value.trim();
      if (!name) { showToast('El nombre es requerido', 'error'); return; }
      const acc = await this.createAccount({
        name, accountType: 'real',
        initialCapital: parseFloat(document.getElementById('realCapital')?.value) || 0,
        brokerName: document.getElementById('realBroker')?.value.trim(),
        riskPerTrade: parseFloat(document.getElementById('realRisk')?.value) || 1,
        color: document.getElementById('realColor')?.value || '#4ade80',
      });
      if (acc) { closeModal('setupModal'); show('setupStep1'); showToast('¡Cuenta creada! 🚀'); this.renderDashboard(); }
    });

    // ── SUBMIT: PropFirm ──────────────────────────────────────────────
    document.getElementById('setupFormPropfirmForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('pfName')?.value.trim();
      const cap  = parseFloat(document.getElementById('pfCapital')?.value) || 0;
      if (!name) { showToast('El nombre es requerido', 'error'); return; }
      if (cap <= 0) { showToast('Ingresa el capital fondeado', 'error'); return; }
      const currentCap = parseFloat(document.getElementById('pfCurrentCapital')?.value) || null;
      const acc = await this.createAccount({
        name, accountType: 'propfirm',
        initialCapital: cap,
        currentCapital: currentCap ?? cap,
        brokerName: document.getElementById('pfFirm')?.value.trim(),
        phase: document.getElementById('pfPhase')?.value,
        maxDD:    parseFloat(document.getElementById('pfMaxDD')?.value)    || 10,
        dailyDD:  parseFloat(document.getElementById('pfDailyDD')?.value)  || 5,
        target:   parseFloat(document.getElementById('pfTarget')?.value)   || 10,
        minTradingDays: parseInt(document.getElementById('pfMinDays')?.value) || null,
        challengeNotes: document.getElementById('pfChallengeNotes')?.value?.trim() || null,
        riskPerTrade: parseFloat(document.getElementById('pfRisk')?.value) || 1,
        color: document.getElementById('pfColor')?.value || '#C9A84C',
      });
      if (acc) { closeModal('setupModal'); show('setupStep1'); showToast('¡Cuenta PropFirm creada! 🏆'); this.renderDashboard(); }
    });

    // ── Formulario Nueva Cuenta (Config) ─────────────────────────────
    const toggleNaType = (type) => {
      const isProp = type === 'propfirm';
      document.getElementById('naPropfirmRules')?.classList.toggle('hidden', !isProp);
      document.getElementById('naPhaseRow')?.classList.toggle('hidden', !isProp);
      document.getElementById('naCurrentCapRow')?.classList.toggle('hidden', !isProp);
      const brokerLabel = document.getElementById('naBrokerLabel');
      if (brokerLabel) brokerLabel.textContent = isProp ? 'Firma' : 'Broker';
      document.querySelectorAll('.na-type-inner').forEach(el => {
        el.style.borderColor = 'var(--border)';
        el.style.background  = 'transparent';
      });
      const active = type === 'real'
        ? document.getElementById('naTypeReal')?.nextElementSibling
        : document.getElementById('naTypePropfirm')?.nextElementSibling;
      if (active) { active.style.borderColor = 'var(--accent-blue)'; active.style.background = 'var(--accent-dim)'; }
    };
    document.querySelectorAll('input[name="naType"]').forEach(r =>
      r.addEventListener('change', e => toggleNaType(e.target.value))
    );
    toggleNaType('propfirm');

    document.getElementById('newAccountForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('naName')?.value.trim();
      const cap  = parseFloat(document.getElementById('naCapital')?.value) || 0;
      if (!name || cap <= 0) { showToast('Completa los campos requeridos', 'error'); return; }
      const type = document.querySelector('input[name="naType"]:checked')?.value || 'propfirm';
      const currentCap = parseFloat(document.getElementById('naCurrentCapital')?.value) || null;
      const acc = await this.createAccount({
        name, accountType: type, initialCapital: cap,
        currentCapital: currentCap ?? cap,
        maxDD:       type === 'propfirm' ? (parseFloat(document.getElementById('naMaxDD')?.value)    || 10) : null,
        dailyDD:     type === 'propfirm' ? (parseFloat(document.getElementById('naDailyDD')?.value)  || 5)  : null,
        target:      type === 'propfirm' ? (parseFloat(document.getElementById('naTarget')?.value)   || 10) : null,
        minTradingDays: type === 'propfirm' ? (parseInt(document.getElementById('naMinDays')?.value) || null) : null,
        challengeNotes: type === 'propfirm' ? (document.getElementById('naChallengeNotes')?.value?.trim() || null) : null,
        riskPerTrade: parseFloat(document.getElementById('naRisk')?.value) || 1,
        color:        document.getElementById('naColor')?.value || '#3b82f6',
        brokerName:   document.getElementById('naBroker')?.value?.trim(),
        phase:        document.getElementById('naPhase')?.value,
      });
      if (acc) { closeModal('newAccountModal'); document.getElementById('newAccountForm')?.reset(); toggleNaType('propfirm'); this.renderConfig(); showToast('Cuenta creada'); }
    });
  }

  async createAccount(data) {
    const acc = await saveAccount({
      name: data.name, initialCapital: data.initialCapital || 0,
      currentCapital: data.currentCapital ?? data.initialCapital ?? 0,
      accountType: data.accountType || 'propfirm',
      maxDD: data.maxDD || null, dailyDD: data.dailyDD || null,
      target: data.target || null, riskPerTrade: data.riskPerTrade || 1,
      color: data.color || '#3b82f6',
      brokerName: data.brokerName || null, phase: data.phase || null,
      minTradingDays: data.minTradingDays || null,
      challengeNotes: data.challengeNotes || null,
    }, this.userId);
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
    const base = acc.currentCapital ?? acc.initialCapital;
    return this.trades
      .filter(t => t.accountId === accountId && t.result !== 'OPEN')
      .reduce((b, t) => b + calcPL(t, acc.initialCapital), base);
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

  openEditAccountModal(id) {
    const acc = this.getAccountById(id || this.activeAccount);
    if (!acc) return;
    // Rellenar el formulario con los datos actuales
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
    set('editAccId',         acc.id);
    set('editAccName',       acc.name);
    set('editAccBroker',     acc.brokerName || '');
    set('editAccPhase',      acc.phase || '');
    set('editAccCurrentCap', acc.currentCapital ?? acc.initialCapital);
    set('editAccMaxDD',      acc.maxDD  || '');
    set('editAccDailyDD',    acc.dailyDD || '');
    set('editAccTarget',     acc.target || '');
    set('editAccMinDays',    acc.minTradingDays || '');
    set('editAccNotes',      acc.challengeNotes || '');
    set('editAccRisk',       acc.riskPerTrade || 1);

    // Mostrar/ocultar sección PropFirm
    const isProp = acc.accountType === 'propfirm';
    document.getElementById('editAccPropfirmRules')?.classList.toggle('hidden', !isProp);
    document.getElementById('editAccPhaseRow')?.classList.toggle('hidden', !isProp);

    openModal('editAccountModal');
  }

  setupEditAccountForm() {
    document.getElementById('editAccountForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const id  = document.getElementById('editAccId')?.value;
      const acc = this.getAccountById(id);
      if (!acc) return;

      const isProp = acc.accountType === 'propfirm';
      const updated = {
        ...acc,
        name:          document.getElementById('editAccName')?.value.trim()  || acc.name,
        brokerName:    document.getElementById('editAccBroker')?.value.trim() || null,
        phase:         document.getElementById('editAccPhase')?.value        || null,
        currentCapital: parseFloat(document.getElementById('editAccCurrentCap')?.value) || acc.currentCapital,
        riskPerTrade:   parseFloat(document.getElementById('editAccRisk')?.value)        || acc.riskPerTrade,
        maxDD:    isProp ? (parseFloat(document.getElementById('editAccMaxDD')?.value)   || acc.maxDD)    : acc.maxDD,
        dailyDD:  isProp ? (parseFloat(document.getElementById('editAccDailyDD')?.value) || acc.dailyDD)  : acc.dailyDD,
        target:   isProp ? (parseFloat(document.getElementById('editAccTarget')?.value)  || acc.target)   : acc.target,
        minTradingDays: isProp ? (parseInt(document.getElementById('editAccMinDays')?.value) || null) : null,
        challengeNotes: isProp ? (document.getElementById('editAccNotes')?.value.trim()  || null) : null,
      };

      const saved = await saveAccount(updated, this.userId);
      if (!saved) { showToast('Error al guardar', 'error'); return; }

      // Actualizar en memoria
      const idx = this.accounts.findIndex(a => a.id === id);
      if (idx >= 0) this.accounts[idx] = { ...this.accounts[idx], ...updated };

      closeModal('editAccountModal');
      this.populateAccountSelector();
      this.renderConfig();
      this.renderDashboard();
      showToast('Cuenta actualizada ✓');
    });
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
      ? '<p class="text-xs" style="color:var(--text-muted)">No hay cuentas.</p>'
      : this.accounts.map(a => {
          const bal = this.getAccountBalance(a.id);
          const pnl = bal - a.initialCapital;
          const pct = a.initialCapital > 0 ? pnl / a.initialCapital * 100 : 0;
          const isProp = a.accountType === 'propfirm';
          const typeBadge = isProp
            ? `<span style="background:var(--accent-dim);color:#93c5fd;border:1px solid rgba(29,107,251,0.25);border-radius:4px;font-size:9px;padding:1px 6px;font-family:var(--font-data)">PROPFIRM</span>`
            : `<span style="background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.25);border-radius:4px;font-size:9px;padding:1px 6px;font-family:var(--font-data)">REAL</span>`;
          const phaseBadge = a.phase
            ? `<span style="background:rgba(168,85,247,0.1);color:#c4b5fd;border:1px solid rgba(168,85,247,0.2);border-radius:4px;font-size:9px;padding:1px 6px">${a.phase}</span>`
            : '';
          return `<div class="glass-effect p-3 flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${a.color}"></div>
              <div class="min-w-0">
                <div class="flex items-center gap-1 flex-wrap">
                  <span style="font-weight:700;font-size:13px;color:var(--text-primary)">${a.name}</span>
                  ${typeBadge} ${phaseBadge}
                </div>
                <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-data);margin-top:2px">
                  $${a.initialCapital.toLocaleString('en')}
                  ${isProp && a.maxDD ? ` · DD ${a.maxDD}%` : ''}
                  ${isProp && a.dailyDD ? ` · Diario ${a.dailyDD}%` : ''}
                  ${isProp && a.target  ? ` · Obj ${a.target}%` : ''}
                  ${a.brokerName ? ` · ${a.brokerName}` : ''}
                </div>
              </div>
            </div>
            <div class="text-right flex-shrink-0 ml-2">
              <div style="font-family:var(--font-data);font-weight:700;font-size:13px;color:${pnl >= 0 ? 'var(--win-gold)' : 'var(--loss-red)'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>
              <div class="flex gap-2 justify-end mt-1">
                <button onclick="window.journal.openEditAccountModal('${a.id}')" class="text-xs" style="color:var(--accent-blue);opacity:.85">Editar</button>
                <button onclick="window.journal.deleteAccount('${a.id}')" class="text-xs" style="color:var(--loss-red);opacity:.7">Eliminar</button>
              </div>
            </div>
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
