/**
 * main.js — Entry point
 * Inicializa la app y expone en window lo que el HTML necesita.
 */
import './styles.css';
import { openModal, closeModal } from './utils/helpers.js';
import { TradingJournal }        from './modules/TradingJournal.js';

// Exponer en window para los onclick del HTML
window.openModal  = openModal;
window.closeModal = closeModal;

// Arranque
window.journal = new TradingJournal();
