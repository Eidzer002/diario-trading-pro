/**
 * main.js — Entry point con autenticación
 */
import './styles.css';
import { openModal, closeModal, showToast } from './utils/helpers.js';
import { TradingJournal } from './modules/TradingJournal.js';
import { signIn, signUp, signOut, getSession, onAuthChange } from './auth.js';

window.openModal  = openModal;
window.closeModal = closeModal;

// ── AUTH UI ──────────────────────────────────────────────────────────────
const authScreen = document.getElementById('authScreen');
const appScreen  = document.getElementById('appScreen');

function showAuth()  { authScreen?.classList.remove('hidden'); appScreen?.classList.add('hidden'); }
function showApp()   { authScreen?.classList.add('hidden');    appScreen?.classList.remove('hidden'); }

let journalInstance = null;

async function bootApp(session) {
  showApp();
  // Mostrar email del usuario
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = session.user.email;
  // Inicializar journal con user_id
  if (!journalInstance) {
    journalInstance = new TradingJournal(session.user.id);
    window.journal = journalInstance;
    await journalInstance.init();
  }
}

// ── AUTH FORM LOGIC ──────────────────────────────────────────────────────
let isLoginMode = true;

function setAuthMode(login) {
  isLoginMode = login;
  document.getElementById('authTitle').textContent        = login ? 'Iniciar sesión' : 'Crear cuenta';
  document.getElementById('authSubmitBtn').textContent    = login ? 'Entrar' : 'Registrarme';
  document.getElementById('authToggleText').textContent   = login ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
  document.getElementById('authToggleBtn').textContent    = login ? 'Regístrate' : 'Inicia sesión';
  document.getElementById('authConfirmGroup').classList.toggle('hidden', login);
}

document.getElementById('authToggleBtn')?.addEventListener('click', () => setAuthMode(!isLoginMode));

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const confirm  = document.getElementById('authConfirm').value;
  const btn      = document.getElementById('authSubmitBtn');
  const errEl    = document.getElementById('authError');

  if (!isLoginMode && password !== confirm) {
    errEl.textContent = 'Las contraseñas no coinciden'; errEl.classList.remove('hidden'); return;
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.classList.remove('hidden'); return;
  }

  btn.disabled = true; btn.textContent = '...';
  errEl.classList.add('hidden');
  try {
    if (isLoginMode) {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      errEl.textContent  = '✅ Cuenta creada. Revisa tu email para confirmar.';
      errEl.style.color  = '#4ade80';
      errEl.classList.remove('hidden');
    }
  } catch (err) {
    const msgs = {
      'Invalid login credentials': 'Email o contraseña incorrectos',
      'User already registered':   'Ya existe una cuenta con este email',
      'Email not confirmed':        'Confirma tu email antes de entrar',
    };
    errEl.textContent = msgs[err.message] || err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = isLoginMode ? 'Entrar' : 'Registrarme';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut();
  journalInstance = null;
  window.journal  = null;
  showToast('Sesión cerrada', 'info');
});

// ── BOOT ─────────────────────────────────────────────────────────────────
onAuthChange(async (session) => {
  if (session) { await bootApp(session); }
  else         { showAuth(); }
});

// Check inicial
const session = await getSession();
if (session) { await bootApp(session); }
else         { showAuth(); }
